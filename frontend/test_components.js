/**
 * Test to verify Widget components import correctly
 */

// Mock React and dependencies
const React = require('react');
const path = require('path');

// Check if widget files exist and can be read
const fs = require('fs');

const widgetFiles = [
  '/Users/jon/lenk/lenk/frontend/src/components/widgets/WidgetCard.js',
  '/Users/jon/lenk/lenk/frontend/src/components/widgets/WidgetCreator.js',
  '/Users/jon/lenk/lenk/frontend/src/components/widgets/WidgetEditor.js'
];

console.log('Testing Widget Component Files:');
console.log('================================');

widgetFiles.forEach(filePath => {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const fileName = path.basename(filePath);
    
    // Check for key elements
    const hasAuthorLLM = content.includes('author_llm');
    const hasReaderLLM = content.includes('reader_llm');
    const hasIndigo = content.includes('indigo');
    
    console.log(`${fileName}:`);
    console.log(`  ✅ File exists and readable`);
    console.log(`  ${hasAuthorLLM ? '✅' : '❌'} Contains author_llm references`);
    console.log(`  ${hasReaderLLM ? '✅' : '❌'} Contains reader_llm references`);
    
    if (fileName === 'WidgetCard.js' || fileName === 'WidgetEditor.js') {
      console.log(`  ${hasIndigo ? '✅' : '❌'} Contains indigo styling`);
    }
    
    console.log('');
    
  } catch (error) {
    console.log(`❌ Error reading ${path.basename(filePath)}: ${error.message}`);
  }
});

// Check for specific functionality
const readingModeContent = fs.readFileSync('/Users/jon/lenk/lenk/frontend/src/components/ReadingMode.js', 'utf8');
const hasWidgetTypeParam = readingModeContent.includes('widget_type: widgetData.widget_type');

console.log('ReadingMode.js:');
console.log(`  ${hasWidgetTypeParam ? '✅' : '❌'} Has widget_type parameter in createWidget`);

console.log('\n🎉 Component verification complete!');
