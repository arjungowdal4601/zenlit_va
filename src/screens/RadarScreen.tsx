import React, { useState, useEffect, useRef, useCallback } from 'react';
import { RadarUserCard } from '../components/radar/RadarUserCard';
import { LocationPermissionModal } from '../components/radar/LocationPermissionModal';
import { User, UserLocation, LocationPermissionStatus } from '../types';
import { MapPinIcon, ExclamationTriangleIcon, ArrowPathIcon, EyeSlashIcon, EyeIcon } from '@heroicons/react/24/outline';
import { supabase } from '../lib/supabase';
import { transformProfileToUser } from '../../lib/utils';
import { 
  requestLocationAndSave, 
  getNearbyUsers, 
  checkLocationPermission,
  isGeolocationSupported,
  isSecureContext,
  watchUserLocation,
  stopWatchingLocation,
  hasLocationChanged,
  saveUserLocation,
  removeUserLocation,
  createDebouncedLocationUpdate,
  updateRadarVisibility
} from '../lib/location';
import { getOrCreateConversation } from '../lib/messaging';

interface Props {
  userGender: 'male' | 'female';
  onNavigate: (tab: string) => void;
  onViewProfile: (user: User) => void;
  onMessageUser?: (user: User) => void;
}

export const RadarScreen: React.FC<Props> = ({ 
  userGender, 
  onNavigate, 
  onViewProfile, 
  onMessageUser 
}) => {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [currentLocation, setCurrentLocation] = useState<UserLocation | null>(null);
  const [locationPermission, setLocationPermission] = useState<LocationPermissionStatus>({
    granted: false,
    denied: false,
    pending: true
  });
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [isRequestingLocation, setIsRequestingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isLocationTracking, setIsLocationTracking] = useState(false);
  const [lastLocationUpdate, setLastLocationUpdate] = useState<number>(0);
  const [isUpdatingUsers, setIsUpdatingUsers] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hideFromRadar, setHideFromRadar] = useState(false);
  const [locationSharingEnabled, setLocationSharingEnabled] = useState(false); // New state for location toggle

  // Refs for cleanup
  const locationWatchId = useRef<number | null>(null);
  const mountedRef = useRef(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    mountedRef.current = true;
    initializeRadar();

    // Cleanup on unmount
    return () => {
      mountedRef.current = false;
      if (locationWatchId.current !== null) {
        stopWatchingLocation(locationWatchId.current);
        locationWatchId.current = null;
      }
    };
  }, []);

  // Handle app close/unload - remove location when app is closed
  useEffect(() => {
    const handleBeforeUnload = async () => {
      if (currentUser && locationSharingEnabled) {
        // Remove location from database when app is closed
        await removeUserLocation(currentUser.id);
      }
    };

    const handleVisibilityChange = async () => {
      if (document.hidden && currentUser && locationSharingEnabled) {
        // Remove location when app goes to background
        await removeUserLocation(currentUser.id);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [currentUser, locationSharingEnabled]);

  const initializeRadar = async () => {
    try {
      console.log('🚀 RADAR DEBUG: Initializing radar screen with location toggle');
      
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        console.error('🚀 RADAR DEBUG: User not found:', userError);
        setIsLoading(false);
        return;
      }

      console.log('🚀 RADAR DEBUG: Current user found:', user.id);

      // Get user profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError || !profile) {
        console.error('🚀 RADAR DEBUG: Profile not found:', profileError);
        setIsLoading(false);
        return;
      }

      console.log('🚀 RADAR DEBUG: User profile loaded:', {
        id: profile.id,
        name: profile.name,
        hasLocation: !!(profile.latitude && profile.longitude),
        latitude: profile.latitude,
        longitude: profile.longitude,
        hide_from_radar: profile.hide_from_radar
      });

      setCurrentUser(profile);
      setHideFromRadar(profile.hide_from_radar || false);

      // Check if user has location data - this determines initial toggle state
      const hasLocationData = !!(profile.latitude && profile.longitude);
      setLocationSharingEnabled(hasLocationData);

      if (hasLocationData) {
        console.log('🚀 RADAR DEBUG: User has existing location data');
        const userLocation: UserLocation = {
          latitude: profile.latitude,
          longitude: profile.longitude,
          timestamp: Date.now()
        };
        setCurrentLocation(userLocation);
        setLocationPermission({ granted: true, denied: false, pending: false });
        // Load nearby users since location sharing is enabled
        await loadNearbyUsers(user.id, userLocation);
        
        // Start location tracking for dynamic updates
        startLocationTracking(user.id);
      } else {
        console.log('🚀 RADAR DEBUG: No location data, location sharing disabled');
        // No location data means location sharing is off
        setUsers([]);
        setLocationPermission({ granted: false, denied: false, pending: true });
      }
    } catch (error) {
      console.error('🚀 RADAR DEBUG: Error initializing radar:', error);
      setUsers([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Load users with exact coordinate match
  const loadNearbyUsers = async (currentUserId: string, location: UserLocation) => {
    try {
      console.log('🔄 RADAR DEBUG: Loading users with exact coordinate match');
      
      if (!isUpdatingUsers && !isRefreshing) {
        setIsLoading(true);
      }

      // Use the updated getNearbyUsers function with coordinate matching
      const result = await getNearbyUsers(currentUserId, location, 20);

      if (!result.success) {
        console.error('Error loading nearby users:', result.error);
        if (mountedRef.current) {
          setUsers([]);
        }
        return;
      }

      // Transform profiles to User type
      const transformedUsers: User[] = (result.users || []).map(profile => {
        const user = transformProfileToUser(profile);
        user.distance = 0; // All users in same bucket have distance 0
        return user;
      });

      console.log('🔄 RADAR DEBUG: Final users in same location bucket:', transformedUsers);

      if (mountedRef.current) {
        setUsers(transformedUsers);
        console.log(`🔄 RADAR DEBUG: Set ${transformedUsers.length} users in same location bucket`);
      }
    } catch (error) {
      console.error('🔄 RADAR DEBUG: Error in loadNearbyUsers:', error);
      if (mountedRef.current) {
        setUsers([]);
      }
    } finally {
      if (mountedRef.current && !isUpdatingUsers) {
        setIsLoading(false);
      }
    }
  };

  // Debounced function to update users when location changes
  const debouncedUpdateUsers = useCallback(
    createDebouncedLocationUpdate(async (location: UserLocation) => {
      if (!currentUser || !mountedRef.current) return;
      
      console.log('Location bucket changed, updating users...');
      setIsUpdatingUsers(true);
      
      try {
        // Save new location to profile
        await saveUserLocation(currentUser.id, location);
        
        // Update nearby users with exact coordinate match
        await loadNearbyUsers(currentUser.id, location);
        
        setLastLocationUpdate(Date.now());
      } catch (error) {
        console.error('Error updating users after location change:', error);
      } finally {
        if (mountedRef.current) {
          setIsUpdatingUsers(false);
        }
      }
    }, 3000), // 3 second debounce
    [currentUser]
  );

  const startLocationTracking = (userId: string) => {
    if (locationWatchId.current !== null) {
      stopWatchingLocation(locationWatchId.current);
    }

    console.log('Starting dynamic location tracking for coordinate bucketing...');
    setIsLocationTracking(true);

    const watchId = watchUserLocation(
      (newLocation: UserLocation) => {
        if (!mountedRef.current) return;

        setCurrentLocation(prevLocation => {
          // Check if location bucket has changed (rounded coordinates)
          if (prevLocation && hasLocationChanged(prevLocation, newLocation)) {
            console.log('Location bucket changed, updating users');
            debouncedUpdateUsers(newLocation);
          }
          
          return newLocation;
        });
      },
      (error: string) => {
        if (!mountedRef.current) return;
        
        console.error('Location tracking error:', error);
        setLocationError(error);
        setIsLocationTracking(false);
        
        if (locationWatchId.current !== null) {
          stopWatchingLocation(locationWatchId.current);
          locationWatchId.current = null;
        }
      }
    );

    if (watchId !== null) {
      locationWatchId.current = watchId;
    } else {
      setIsLocationTracking(false);
    }
  };

  const handleRequestLocation = async () => {
    if (!currentUser) return;

    setIsRequestingLocation(true);
    setLocationError(null);

    try {
      const result = await requestLocationAndSave(currentUser.id, currentUser.location);
      
      if (result.success && result.location) {
        console.log('Location obtained and saved successfully for coordinate matching');
        setCurrentLocation(result.location);
        setLocationPermission({ granted: true, denied: false, pending: false });
        setShowLocationModal(false);
        setLastLocationUpdate(Date.now());
        setLocationSharingEnabled(true); // Enable location sharing
        
        // Load users with exact coordinate match
        await loadNearbyUsers(currentUser.id, result.location);
        
        // Start location tracking for dynamic updates
        startLocationTracking(currentUser.id);
      } else {
        console.error('Failed to get location:', result.error);
        setLocationError(result.error || 'Failed to get location');
        
        // Cannot show users without location for coordinate matching
        setUsers([]);
        
        // Update permission status based on error
        if (result.error?.includes('denied')) {
          setLocationPermission({ granted: false, denied: true, pending: false });
        }
      }
    } catch (error) {
      console.error('Location request error:', error);
      setLocationError('Failed to get location. Cannot show users without location.');
      
      // Cannot show users without location
      setUsers([]);
    } finally {
      setIsRequestingLocation(false);
    }
  };

  const handleViewProfile = (user: User) => {
    onViewProfile(user);
    onNavigate('profile');
  };

  const handleMessage = async (user: User) => {
    if (!currentUser) {
      console.error('🔍 [RadarScreen] No current user found');
      return;
    }

    try {
      console.log('🔍 [RadarScreen] Creating/finding conversation between', currentUser.id, 'and', user.id);
      
      // Get or create conversation using the messaging service
      const result = await getOrCreateConversation(currentUser.id, user.id);
      
      if (result.success && result.conversation) {
        console.log('🔍 [RadarScreen] Conversation found/created:', result.conversation.id);
        
        // Navigate directly to messages with the selected user
        if (onMessageUser) {
          onMessageUser(user);
        }
        onNavigate('messages');
      } else {
        console.error('🔍 [RadarScreen] Failed to create/find conversation:', result.error);
        alert('Failed to start conversation. Please try again.');
      }
    } catch (error) {
      console.error('🔍 [RadarScreen] Error handling message:', error);
      alert('Failed to start conversation. Please try again.');
    }
  };

  const handleEnablePreciseLocation = () => {
    setShowLocationModal(true);
  };

  // Handle location sharing toggle
  const handleLocationSharingToggle = async () => {
    if (!currentUser) return;

    const newSharingState = !locationSharingEnabled;
    
    try {
      if (newSharingState) {
        // Enable location sharing - request location
        await handleRequestLocation();
      } else {
        // Disable location sharing - remove location from database
        console.log('Disabling location sharing, removing location from database');
        
        // Stop location tracking
        if (locationWatchId.current !== null) {
          stopWatchingLocation(locationWatchId.current);
          locationWatchId.current = null;
          setIsLocationTracking(false);
        }
        
        // Remove location from database
        const result = await removeUserLocation(currentUser.id);
        
        if (result.success) {
          setLocationSharingEnabled(false);
          setCurrentLocation(null);
          setUsers([]); // Clear nearby users
          setLocationPermission({ granted: false, denied: false, pending: true });
          console.log('Location sharing disabled and location removed from database');
        } else {
          console.error('Failed to remove location:', result.error);
          alert('Failed to disable location sharing. Please try again.');
        }
      }
    } catch (error) {
      console.error('Error toggling location sharing:', error);
      alert('Failed to update location sharing. Please try again.');
    }
  };

  // Handle radar visibility toggle
  const handleRadarVisibilityToggle = async () => {
    if (!currentUser) return;

    const newVisibility = !hideFromRadar;
    setHideFromRadar(newVisibility);

    try {
      const result = await updateRadarVisibility(currentUser.id, newVisibility);
      
      if (!result.success) {
        // Revert the toggle if update failed
        setHideFromRadar(!newVisibility);
        console.error('Failed to update radar visibility:', result.error);
        alert('Failed to update visibility setting. Please try again.');
      } else {
        console.log('Radar visibility updated successfully');
      }
    } catch (error) {
      // Revert the toggle if update failed
      setHideFromRadar(!newVisibility);
      console.error('Error updating radar visibility:', error);
      alert('Failed to update visibility setting. Please try again.');
    }
  };

  // Pull to refresh handler
  const handleRefresh = async () => {
    if (isRefreshing || !currentUser || !currentLocation) return;
    
    setIsRefreshing(true);
    setLocationError(null);
    
    try {
      // Refresh location and reload users
      if (isGeolocationSupported() && isSecureContext()) {
        await handleRequestLocation();
      } else if (currentLocation) {
        // Just reload users with current location
        await loadNearbyUsers(currentUser.id, currentLocation);
      }
      setLastLocationUpdate(Date.now());
    } catch (error) {
      console.error('Refresh error:', error);
      setLocationError('Failed to refresh. Please try again.');
    } finally {
      setIsRefreshing(false);
    }
  };

  // Pull to refresh implementation
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const startY = useRef(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (scrollRef.current && scrollRef.current.scrollTop === 0) {
      startY.current = e.touches[0].clientY;
      setIsPulling(true);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isPulling || !scrollRef.current) return;
    
    const currentY = e.touches[0].clientY;
    const distance = Math.max(0, currentY - startY.current);
    
    if (distance > 0 && scrollRef.current.scrollTop === 0) {
      e.preventDefault();
      setPullDistance(Math.min(distance, 100));
    }
  };

  const handleTouchEnd = () => {
    if (isPulling && pullDistance > 60) {
      handleRefresh();
    }
    setIsPulling(false);
    setPullDistance(0);
  };

  // Automatically refresh location every 120 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (
        currentUser &&
        currentLocation &&
        locationSharingEnabled &&
        !isRefreshing &&
        Date.now() - lastLocationUpdate >= 120000
      ) {
        handleRefresh();
      }
    }, 10000); // check every 10 seconds

    return () => clearInterval(interval);
  }, [currentUser, currentLocation, locationSharingEnabled, lastLocationUpdate, isRefreshing]);

  if (isLoading) {
    return (
      <div className="min-h-full bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Finding people nearby...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-black">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-black/90 backdrop-blur-sm border-b border-gray-800">
        <div className="px-4 py-4">
          <div className="flex items-center justify-between">
            {/* Left side - Title and Location Status */}
            <div className="flex-1">
              <h1 className="text-xl font-bold text-white">People Nearby</h1>
              <div className="flex items-center gap-2 mt-1">
                {/* Location status with icon only */}
                <div className="flex items-center gap-1">
                  {isLocationTracking ? (
                    <div className="w-4 h-4 bg-green-500 rounded-full animate-pulse" />
                  ) : currentLocation ? (
                    <MapPinIcon className="w-4 h-4 text-blue-500" />
                  ) : (
                    <MapPinIcon className="w-4 h-4 text-gray-500" />
                  )}
                  <span className={`text-xs ${
                    isLocationTracking ? 'text-green-400' : 
                    currentLocation ? 'text-blue-400' : 'text-gray-400'
                  }`}>
                    {isLocationTracking ? 'Live tracking' : 
                     currentLocation ? 'Location enabled' : 'Location disabled'}
                  </span>
                </div>
                
                {/* Update indicator */}
                {(isUpdatingUsers || isRefreshing) && (
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs text-blue-400">
                      {isRefreshing ? 'Refreshing...' : 'Updating...'}
                    </span>
                  </div>
                )}
              </div>
            </div>
            
            {/* Right side - Location Sharing Toggle */}
            <div className="flex flex-col items-end gap-2 ml-4">
              {/* Location Sharing Toggle */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">Location</span>
                <button
                  onClick={handleLocationSharingToggle}
                  disabled={isRequestingLocation}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    locationSharingEnabled ? 'bg-green-600' : 'bg-gray-600'
                  } ${isRequestingLocation ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <div
                    className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                      locationSharingEnabled ? 'translate-x-7' : 'translate-x-1'
                    }`}
                  />
                  {isRequestingLocation && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                </button>
              </div>
              
              {/* Refresh Button */}
              <button
                onClick={handleRefresh}
                disabled={isRefreshing || !currentLocation}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ArrowPathIcon className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Radar Visibility Toggle */}
      <div className="px-4 py-3 bg-gray-900/50 border-b border-gray-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {hideFromRadar ? (
              <EyeSlashIcon className="w-5 h-5 text-orange-500" />
            ) : (
              <EyeIcon className="w-5 h-5 text-green-500" />
            )}
            <div>
              <span className="text-sm font-medium text-white">
                {hideFromRadar ? 'Hidden from nearby users' : 'Visible to nearby users'}
              </span>
              <p className="text-xs text-gray-400">
                {hideFromRadar 
                  ? 'Others cannot see you on their radar' 
                  : 'Others can see you when you are nearby'
                }
              </p>
            </div>
          </div>
          <button
            onClick={handleRadarVisibilityToggle}
            className={`relative w-12 h-6 rounded-full transition-colors ${
              hideFromRadar ? 'bg-orange-600' : 'bg-green-600'
            }`}
          >
            <div
              className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                hideFromRadar ? 'translate-x-1' : 'translate-x-7'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Location Status Info */}
      {!locationSharingEnabled && (
        <div className="px-4 py-3 bg-blue-900/20 border-b border-blue-700/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ExclamationTriangleIcon className="w-5 h-5 text-blue-500" />
              <div>
                <span className="text-sm text-blue-400 font-medium">Location Sharing Disabled</span>
                <p className="text-xs text-blue-300">
                  Enable location sharing to find people nearby
                </p>
              </div>
            </div>
            <button
              onClick={handleLocationSharingToggle}
              className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors"
            >
              Enable
            </button>
          </div>
        </div>
      )}

      {/* Pull to refresh indicator */}
      {isPulling && pullDistance > 0 && (
        <div className="flex justify-center py-2 bg-gray-900/50">
          <div className="flex items-center gap-2">
            <div className={`w-4 h-4 border-2 border-blue-500 rounded-full transition-transform ${
              pullDistance > 60 ? 'border-t-transparent animate-spin' : ''
            }`} />
            <span className="text-xs text-blue-400">
              {pullDistance > 60 ? 'Release to refresh' : 'Pull down to refresh'}
            </span>
          </div>
        </div>
      )}

      {/* Users List */}
      <div 
        ref={scrollRef}
        className="px-4 py-4 space-y-4 pb-20 overflow-y-auto"
        style={{ 
          transform: `translateY(${Math.min(pullDistance * 0.5, 50)}px)`,
          transition: isPulling ? 'none' : 'transform 0.3s ease'
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {locationSharingEnabled && currentLocation ? (
          users.length > 0 ? (
            users.map((user) => (
              <RadarUserCard
                key={user.id}
                user={user}
                onMessage={handleMessage}
                onViewProfile={() => handleViewProfile(user)}
              />
            ))
          ) : (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                <MapPinIcon className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-gray-500 text-sm">
                Move around or check back later to find people nearby!
              </p>
            </div>
          )
        ) : (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <ExclamationTriangleIcon className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-gray-400 mb-2">Location Sharing Disabled</p>
            <p className="text-gray-500 text-sm mb-4">
              Enable location sharing to find people nearby
            </p>
            <button
              onClick={handleLocationSharingToggle}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:scale-95 transition-all"
            >
              Enable Location Sharing
            </button>
          </div>
        )}
      </div>

      {/* Location Permission Modal */}
      <LocationPermissionModal
        isOpen={showLocationModal}
        onClose={() => setShowLocationModal(false)}
        onRequestLocation={handleRequestLocation}
        isRequesting={isRequestingLocation}
        error={locationError || undefined}
      />
    </div>
  );
};