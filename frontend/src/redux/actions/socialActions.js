

import axiosInstance from '../../axiosConfig';
import * as types from '../actionTypes';

// Fetch collective feed
export const fetchCollective = (followingOnly = false) => async (dispatch) => {
  console.log("fetchCollective Redux action called with followingOnly:", followingOnly);
  dispatch({ type: types.FETCH_COLLECTIVE_REQUEST });
  
  try {
    const response = await axiosInstance.get(`/cognitions/collective/?following_only=${followingOnly}`);
    dispatch({
      type: types.FETCH_COLLECTIVE_SUCCESS,
      payload: response.data
    });
  } catch (error) {
    dispatch({
      type: types.FETCH_COLLECTIVE_FAILURE,
      payload: error.response?.data?.error || 'Failed to load collective feed'
    });
  }
};

// Toggle share status of a cognition
export const toggleShare = (cognitionId) => async (dispatch) => {
  dispatch({ type: types.TOGGLE_SHARE_REQUEST });
  
  try {
    const response = await axiosInstance.post(`/cognitions/${cognitionId}/toggle_share/`);
    dispatch({
      type: types.TOGGLE_SHARE_SUCCESS,
      payload: {
        cognitionId,
        isPublic: response.data.is_public
      }
    });
    return response.data;
  } catch (error) {
    dispatch({
      type: types.TOGGLE_SHARE_FAILURE,
      payload: error.response?.data?.error || 'Failed to toggle share status'
    });
    throw error;
  }
};

// Fetch user profiles
export const fetchProfiles = (searchTerm = '') => async (dispatch) => {
  dispatch({ type: types.FETCH_PROFILES_REQUEST });
  
  try {
    const response = await axiosInstance.get(`/profiles/?search=${searchTerm}`);
    dispatch({
      type: types.FETCH_PROFILES_SUCCESS,
      payload: response.data
    });
  } catch (error) {
    dispatch({
      type: types.FETCH_PROFILES_FAILURE,
      payload: error.response?.data?.error || 'Failed to load profiles'
    });
  }
};

// Follow a user
export const followUser = (profileId) => async (dispatch) => {
  dispatch({ type: types.FOLLOW_USER_REQUEST });
  
  try {
    const response = await axiosInstance.post(`/profiles/${profileId}/follow/`);
    dispatch({
      type: types.FOLLOW_USER_SUCCESS,
      payload: {
        profileId,
        message: response.data.message
      }
    });
  } catch (error) {
    dispatch({
      type: types.FOLLOW_USER_FAILURE,
      payload: error.response?.data?.error || 'Failed to follow user'
    });
  }
};

// Unfollow a user
export const unfollowUser = (profileId) => async (dispatch) => {
  dispatch({ type: types.UNFOLLOW_USER_REQUEST });
  
  try {
    const response = await axiosInstance.post(`/profiles/${profileId}/unfollow/`);
    dispatch({
      type: types.UNFOLLOW_USER_SUCCESS,
      payload: {
        profileId,
        message: response.data.message
      }
    });
  } catch (error) {
    dispatch({
      type: types.UNFOLLOW_USER_FAILURE,
      payload: error.response?.data?.error || 'Failed to unfollow user'
    });
  }
};