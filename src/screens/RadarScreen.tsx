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
  createDebouncedLocationUpdate,
  updateRadarVisibility
} from '../lib/location';

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
  const [isVisible, setIsVisible] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hideFromRadar, setHideFromRadar] = useState(false); // New state for radar visibility toggle

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

  const initializeRadar = async () => {
    try {
      console.log('🚀 RADAR DEBUG: Initializing radar screen with coordinate bucketing');
      
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
      setHideFromRadar(profile.hide_from_radar || false); // Set initial radar visibility state

      // Check if user already has location data
      if (profile.latitude && profile.longitude) {
        console.log('🚀 RADAR DEBUG: User has existing location data');
        const userLocation: UserLocation = {
          latitude: profile.latitude,
          longitude: profile.longitude,
          timestamp: Date.now()
        };
        setCurrentLocation(userLocation);
        setLocationPermission({ granted: true, denied: false, pending: false });
        if (isVisible) {
          await loadNearbyUsers(user.id, userLocation);
        }
        
        // Start location tracking for dynamic updates
        startLocationTracking(user.id);
      } else {
        console.log('🚀 RADAR DEBUG: User has no location data, need location for coordinate matching');
        // Try to get real location first
        const permissionStatus = await checkLocationPermission();
        setLocationPermission(permissionStatus);
        
        if (permissionStatus.granted && isGeolocationSupported() && isSecureContext()) {
          // Try to get real location
          try {
            await handleRequestLocation();
          } catch (error) {
            console.log('🚀 RADAR DEBUG: Real location failed, cannot show users without location');
            setUsers([]); // No users without location for coordinate matching
          }
        } else {
          // Cannot show users without location
          console.log('🚀 RADAR DEBUG: Location not available, cannot show users');
          setUsers([]);
        }
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
            if (isVisible) {
              debouncedUpdateUsers(newLocation);
            }
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
        
        // Load users with exact coordinate match if visible
        if (isVisible) {
          await loadNearbyUsers(currentUser.id, result.location);
        }
        
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

  const handleMessage = (user: User) => {
    if (onMessageUser) {
      onMessageUser(user);
    }
    onNavigate('messages');
  };

  const handleEnablePreciseLocation = () => {
    setShowLocationModal(true);
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
        isVisible &&
        currentUser &&
        currentLocation &&
        !isRefreshing &&
        Date.now() - lastLocationUpdate >= 120000
      ) {
        handleRefresh();
      }
    }, 10000); // check every 10 seconds

    return () => clearInterval(interval);
  }, [isVisible, currentUser, currentLocation, lastLocationUpdate, isRefreshing]);

  // When visibility is turned on, request location permission if needed
  useEffect(() => {
    if (!isVisible) return;

    const requestAndLoad = async () => {
      const permission = await checkLocationPermission();
      setLocationPermission(permission);

      if (!permission.granted) {
        try {
          await new Promise<void>((resolve, reject) =>
            navigator.geolocation.getCurrentPosition(() => resolve(), reject)
          );
          setLocationPermission({ granted: true, denied: false, pending: false });
        } catch {
          setLocationPermission({ granted: false, denied: true, pending: false });
          return;
        }
      }

      if (currentUser && currentLocation) {
        await loadNearbyUsers(currentUser.id, currentLocation);
      } else if (currentUser && !currentLocation) {
        await handleRequestLocation();
      }
    };

    requestAndLoad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVisible]);

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
                     currentLocation ? 'Location enabled' : 'Location required'}
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
            
            {/* Right side - Show Nearby Toggle */}
            <div className="flex flex-col items-end gap-1 ml-4">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">Show Nearby</span>
                <input
                  type="checkbox"
                  className="relative w-10 h-5 rounded-full appearance-none bg-gray-700 checked:bg-blue-600 transition-colors cursor-pointer before:absolute before:left-1 before:top-1 before:w-3 before:h-3 before:bg-white before:rounded-full before:transition-transform checked:before:translate-x-5"
                  checked={isVisible}
                  onChange={(e) => setIsVisible(e.target.checked)}
                />
              </div>
              <button
                onClick={handleRefresh}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-white"
              >
                <ArrowPathIcon className="w-4 h-4" />
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
                  : 'Others can see you when you\'re nearby'
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
      {!currentLocation && (
        <div className="px-4 py-3 bg-blue-900/20 border-b border-blue-700/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ExclamationTriangleIcon className="w-5 h-5 text-blue-500" />
              <div>
                <span className="text-sm text-blue-400 font-medium">Location Required</span>
                <p className="text-xs text-blue-300">
                  Enable location to find people nearby
                </p>
              </div>
            </div>
            {isGeolocationSupported() && isSecureContext() && (
              <button
                onClick={handleEnablePreciseLocation}
                className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors"
              >
                Enable
              </button>
            )}
          </div>
        </div>
      )}

      {isLocationTracking && (
        <div className="px-4 py-2 bg-green-900/20 border-b border-green-700/30">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-xs text-green-400">
              Live tracking active - finding people as you move
            </span>
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
        {isVisible ? (
          currentLocation ? (
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
              <p className="text-gray-400 mb-2">Location Access Required</p>
              <p className="text-gray-500 text-sm mb-4">
                We need your location to find people nearby
              </p>
              <button
                onClick={handleEnablePreciseLocation}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:scale-95 transition-all"
              >
                Enable Location
              </button>
            </div>
          )
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-400">Toggle "Show Nearby" to see people around you</p>
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