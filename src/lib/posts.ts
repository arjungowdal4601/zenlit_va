import { supabase } from './supabase';
import { Post, UserLocation } from '../types';
import { deleteImage, extractFilePathFromUrl } from './storage';

export interface CreatePostData {
  title: string;
  caption: string;
  mediaUrl: string;
  mediaType?: string;
}

export async function createPost(postData: CreatePostData): Promise<Post | null> {
  try {
    console.log('🔍 [createPost] Creating post:', postData);

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      console.error('🔍 [createPost] User not authenticated:', userError);
      throw new Error('User not authenticated');
    }

    // Get user profile for post metadata
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('name, profile_photo_url')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      console.error('🔍 [createPost] Failed to get user profile:', profileError);
      throw new Error('Failed to get user profile');
    }

    // Insert post into database
    const { data: newPost, error: postError } = await supabase
      .from('posts')
      .insert({
        user_id: user.id,
        title: postData.title,
        caption: postData.caption,
        media_url: postData.mediaUrl,
        media_type: postData.mediaType || 'image'
      })
      .select()
      .single();

    if (postError) {
      console.error('🔍 [createPost] Failed to create post:', postError);
      throw postError;
    }

    // Transform to Post type
    const transformedPost: Post = {
      id: newPost.id,
      userId: newPost.user_id,
      userName: profile?.name || 'Unknown User',
      userDpUrl: profile?.profile_photo_url || `/images/default-avatar.png`,
      title: newPost.title,
      mediaUrl: newPost.media_url,
      caption: newPost.caption,
      timestamp: newPost.created_at
    };

    console.log('🔍 [createPost] Post created successfully:', transformedPost);
    return transformedPost;
  } catch (error) {
    console.error('🔍 [createPost] Error creating post:', error);
    return null;
  }
}

export async function getUserPosts(userId: string): Promise<Post[]> {
  try {
    console.log('🔍 [getUserPosts] Getting posts for user:', userId);

    if (!userId) {
      console.error('🔍 [getUserPosts] User ID is required');
      return [];
    }

    const { data: posts, error } = await supabase
      .from('posts')
      .select(`
        *,
        profiles:user_id (
          name,
          profile_photo_url
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    console.log('🔍 [getUserPosts] Posts query result:', { posts, error });

    if (error) {
      console.error('🔍 [getUserPosts] Error fetching posts:', error);
      throw error;
    }

    // Transform to Post type
    const transformedPosts: Post[] = (posts || []).map(post => ({
      id: post.id,
      userId: post.user_id,
      userName: post.profiles?.name || 'Unknown User',
      userDpUrl: post.profiles?.profile_photo_url || `/images/default-avatar.png`,
      title: post.title,
      mediaUrl: post.media_url,
      caption: post.caption,
      timestamp: post.created_at
    }));

    console.log('🔍 [getUserPosts] Transformed posts:', transformedPosts);
    return transformedPosts;
  } catch (error) {
    console.error('🔍 [getUserPosts] Error getting user posts:', error);
    return [];
  }
}

export async function getAllPosts(limit: number = 50): Promise<Post[]> {
  try {
    console.log('🔍 [getAllPosts] Getting all posts with limit:', limit);

    const { data: posts, error } = await supabase
      .from('posts')
      .select(`
        *,
        profiles:user_id (
          name,
          profile_photo_url
        )
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    console.log('🔍 [getAllPosts] Posts query result:', { posts, error });

    if (error) {
      console.error('🔍 [getAllPosts] Error fetching posts:', error);
      throw error;
    }

    // Transform to Post type
    const transformedPosts: Post[] = (posts || []).map(post => ({
      id: post.id,
      userId: post.user_id,
      userName: post.profiles?.name || 'Unknown User',
      userDpUrl: post.profiles?.profile_photo_url || `/images/default-avatar.png`,
      title: post.title,
      mediaUrl: post.media_url,
      caption: post.caption,
      timestamp: post.created_at
    }));

    console.log('🔍 [getAllPosts] Transformed posts:', transformedPosts);
    return transformedPosts;
  } catch (error) {
    console.error('🔍 [getAllPosts] Error getting all posts:', error);
    return [];
  }
}

export async function getNearbyPosts(
  currentUserId: string,
  location: UserLocation,
  limit: number = 50
): Promise<Post[]> {
  try {
    console.log('🔍 [getNearbyPosts] Getting nearby posts for user:', currentUserId, 'at location:', location);

    const latRounded = Number(location.latitude.toFixed(2));
    const lonRounded = Number(location.longitude.toFixed(2));

    const { data: posts, error } = await supabase
      .from('posts')
      .select(
        `*, profiles:user_id ( name, profile_photo_url, latitude, longitude )`
      )
      .neq('user_id', currentUserId)
      .eq('profiles.latitude', latRounded)
      .eq('profiles.longitude', lonRounded)
      .order('created_at', { ascending: false })
      .limit(limit);

    console.log('🔍 [getNearbyPosts] Nearby posts query result:', { posts, error });

    if (error) {
      console.error('🔍 [getNearbyPosts] Error fetching nearby posts:', error);
      throw error;
    }

    const transformed: Post[] = (posts || []).map((post) => ({
      id: post.id,
      userId: post.user_id,
      userName: post.profiles?.name || 'Unknown User',
      userDpUrl: post.profiles?.profile_photo_url || `/images/default-avatar.png`,
      title: post.title,
      mediaUrl: post.media_url,
      caption: post.caption,
      timestamp: post.created_at,
    }));

    console.log('🔍 [getNearbyPosts] Transformed nearby posts:', transformed);
    return transformed;
  } catch (error) {
    console.error('🔍 [getNearbyPosts] Error getting nearby posts:', error);
    return [];
  }
}

// Delete post and its associated media from storage
export async function deletePost(postId: string, userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    console.log(`🔍 [deletePost] Deleting post ${postId} for user ${userId}`);
    
    // First, get the post to retrieve the media URL
    const { data: post, error: fetchError } = await supabase
      .from('posts')
      .select('media_url, user_id')
      .eq('id', postId)
      .eq('user_id', userId) // Ensure user owns the post
      .maybeSingle();

    if (fetchError) {
      console.error('🔍 [deletePost] Error fetching post for deletion:', fetchError);
      return { success: false, error: 'Failed to fetch post' };
    }

    if (!post) {
      return { success: false, error: 'Post not found or you do not have permission to delete it' };
    }

    // Delete the media from storage if it exists and is not a placeholder
    if (post.media_url && !post.media_url.includes('/images/default-')) {
      const filePath = extractFilePathFromUrl(post.media_url, 'posts');
      if (filePath) {
        console.log(`🔍 [deletePost] Deleting media file: ${filePath}`);
        const deleteSuccess = await deleteImage('posts', filePath);
        if (!deleteSuccess) {
          console.warn('🔍 [deletePost] Failed to delete media file, but continuing with post deletion');
        }
      }
    }

    // Delete the post from the database
    const { error: deleteError } = await supabase
      .from('posts')
      .delete()
      .eq('id', postId)
      .eq('user_id', userId);

    if (deleteError) {
      console.error('🔍 [deletePost] Error deleting post from database:', deleteError);
      return { success: false, error: 'Failed to delete post from database' };
    }

    console.log(`🔍 [deletePost] Successfully deleted post ${postId}`);
    return { success: true };
  } catch (error) {
    console.error('🔍 [deletePost] Error in deletePost:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}