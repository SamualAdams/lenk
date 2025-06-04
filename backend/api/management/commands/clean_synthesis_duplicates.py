from django.core.management.base import BaseCommand
from django.db import transaction, connection
from api.models import Synthesis

class Command(BaseCommand):
    help = 'Clean up duplicate synthesis records that violate unique constraints'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be deleted without actually deleting',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        
        self.stdout.write('Checking for synthesis records that will cause unique constraint violations...')
        
        # Check for duplicates by node_id alone (the main issue)
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT node_id, COUNT(*) as count 
                FROM api_synthesis 
                GROUP BY node_id 
                HAVING COUNT(*) > 1
                ORDER BY count DESC
            """)
            node_duplicates = cursor.fetchall()
        
        # Also check for duplicates by (node_id, user_id) combination
        synthesis_groups = {}
        for synthesis in Synthesis.objects.all().order_by('created_at'):
            key = (synthesis.node_id, getattr(synthesis, 'user_id', None))
            if key not in synthesis_groups:
                synthesis_groups[key] = []
            synthesis_groups[key].append(synthesis)
        
        user_node_duplicates = [(key, syntheses) for key, syntheses in synthesis_groups.items() if len(syntheses) > 1]
        
        self.stdout.write(f'Found {len(node_duplicates)} nodes with multiple syntheses')
        self.stdout.write(f'Found {len(user_node_duplicates)} (node, user) combinations with duplicates')
        
        if len(node_duplicates) == 0 and len(user_node_duplicates) == 0:
            self.stdout.write(self.style.SUCCESS('No duplicate synthesis records found!'))
            return
        
        # Show details
        if node_duplicates:
            self.stdout.write('\nNodes with multiple syntheses:')
            for node_id, count in node_duplicates[:10]:  # Show first 10
                self.stdout.write(f'  Node {node_id}: {count} syntheses')
            if len(node_duplicates) > 10:
                self.stdout.write(f'  ... and {len(node_duplicates) - 10} more')
        
        if user_node_duplicates:
            self.stdout.write('\n(Node, User) combinations with duplicates:')
            for (node_id, user_id), syntheses in user_node_duplicates[:5]:  # Show first 5
                self.stdout.write(f'  Node {node_id}, User {user_id}: {len(syntheses)} syntheses')
        
        # For migration purposes, we need to ensure each (node, user) has only one synthesis
        to_delete = []
        for key, syntheses in user_node_duplicates:
            # Keep the most recent one, delete others
            syntheses_sorted = sorted(syntheses, key=lambda s: s.updated_at or s.created_at, reverse=True)
            to_delete.extend(syntheses_sorted[1:])  # Keep first (most recent), delete rest
        
        if not to_delete:
            self.stdout.write(self.style.SUCCESS('\nNo cleanup needed for (node, user) uniqueness!'))
        else:
            self.stdout.write(f'\nWill delete {len(to_delete)} duplicate synthesis records')
            
            if dry_run:
                self.stdout.write(self.style.WARNING('DRY RUN - No records were actually deleted.'))
                self.stdout.write('Run without --dry-run to actually delete the duplicates.')
                for synthesis in to_delete[:10]:  # Show first 10
                    self.stdout.write(f'  Would delete: Synthesis {synthesis.id} (Node {synthesis.node_id}, User {getattr(synthesis, "user_id", "None")})')
            else:
                # Delete duplicates
                with transaction.atomic():
                    deleted_count = 0
                    for synthesis in to_delete:
                        synthesis.delete()
                        deleted_count += 1
                    
                    self.stdout.write(
                        self.style.SUCCESS(f'Successfully deleted {deleted_count} duplicate synthesis records.')
                    )
        
        self.stdout.write('\nAfter cleaning, you can run: python manage.py migrate')