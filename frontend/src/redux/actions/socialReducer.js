

import * as types from '../actionTypes';

const initialState = {
  collective: {
    cognitions: [],
    loading: false,
    error: null
  },
  profiles: {
    list: [],
    loading: false,
    error: null
  },
  followStatus: {
    loading: false,
    error: null,
    message: null
  }
};

const socialReducer = (state = initialState, action) => {
  switch (action.type) {
    // Collective feed reducers
    case types.FETCH_COLLECTIVE_REQUEST:
      return {
        ...state,
        collective: {
          ...state.collective,
          loading: true,
          error: null
        }
      };
    case types.FETCH_COLLECTIVE_SUCCESS:
      return {
        ...state,
        collective: {
          cognitions: action.payload,
          loading: false,
          error: null
        }
      };
    case types.FETCH_COLLECTIVE_FAILURE:
      return {
        ...state,
        collective: {
          ...state.collective,
          loading: false,
          error: action.payload
        }
      };

    // Toggle share reducers
    case types.TOGGLE_SHARE_REQUEST:
      return {
        ...state,
        followStatus: {
          ...state.followStatus,
          loading: true,
          error: null,
          message: null
        }
      };
    case types.TOGGLE_SHARE_SUCCESS:
      return {
        ...state,
        followStatus: {
          loading: false,
          error: null,
          message: 'Share status updated'
        },
        collective: {
          ...state.collective,
          cognitions: state.collective.cognitions.map(cognition => 
            cognition.id === action.payload.cognitionId 
              ? { ...cognition, is_public: action.payload.isPublic }
              : cognition
          )
        }
      };
    case types.TOGGLE_SHARE_FAILURE:
      return {
        ...state,
        followStatus: {
          ...state.followStatus,
          loading: false,
          error: action.payload,
          message: null
        }
      };

    // Profile reducers
    case types.FETCH_PROFILES_REQUEST:
      return {
        ...state,
        profiles: {
          ...state.profiles,
          loading: true,
          error: null
        }
      };
    case types.FETCH_PROFILES_SUCCESS:
      return {
        ...state,
        profiles: {
          list: action.payload,
          loading: false,
          error: null
        }
      };
    case types.FETCH_PROFILES_FAILURE:
      return {
        ...state,
        profiles: {
          ...state.profiles,
          loading: false,
          error: action.payload
        }
      };

    // Follow/unfollow reducers
    case types.FOLLOW_USER_REQUEST:
    case types.UNFOLLOW_USER_REQUEST:
      return {
        ...state,
        followStatus: {
          ...state.followStatus,
          loading: true,
          error: null,
          message: null
        }
      };
    case types.FOLLOW_USER_SUCCESS:
    case types.UNFOLLOW_USER_SUCCESS:
      return {
        ...state,
        followStatus: {
          loading: false,
          error: null,
          message: action.payload.message
        },
        profiles: {
          ...state.profiles,
          list: state.profiles.list.map(profile =>
            profile.id === action.payload.profileId
              ? { ...profile, is_following: action.type === types.FOLLOW_USER_SUCCESS }
              : profile
          )
        }
      };
    case types.FOLLOW_USER_FAILURE:
    case types.UNFOLLOW_USER_FAILURE:
      return {
        ...state,
        followStatus: {
          ...state.followStatus,
          loading: false,
          error: action.payload,
          message: null
        }
      };

    default:
      return state;
  }
};

export default socialReducer;