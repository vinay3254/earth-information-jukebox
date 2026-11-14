/**
 * src/globe/coordinates.js
 *
 * Geographical coordinate conversions for Three.js sphere.
 * 
 * In standard equirectangular Three.js SphereGeometry:
 * - Lat: +90 (North) -> +Y, -90 (South) -> -Y, 0 (Equator) -> Y=0
 * - Lon: 0 (Prime Meridian) -> +X
 * - Lon: +90 (East) -> -Z
 * - Lon: -90 (West) -> +Z
 * - Lon: +/-180 -> -X
 */

import * as THREE from 'three';

const DEG2RAD = Math.PI / 180;

/**
 * Convert latitude and longitude in degrees to a 3D position vector on a sphere.
 * @param {number} lat - Latitude in degrees (-90 to +90)
 * @param {number} lon - Longitude in degrees (-180 to +180)
 * @param {number} radius - Sphere radius (default 1.0)
 * @returns {THREE.Vector3}
 */
export function latLonToVector3(lat, lon, radius = 1.0) {
  const phi = lat * DEG2RAD;
  const lambda = lon * DEG2RAD;
  const cosPhi = Math.cos(phi);

  const x = radius * cosPhi * Math.cos(lambda);
  const y = radius * Math.sin(phi);
  const z = -radius * cosPhi * Math.sin(lambda);

  return new THREE.Vector3(x, y, z);
}

/**
 * Compute recommended camera focus position looking directly at a lat/lon point from a given distance.
 * @param {number} lat - Latitude in degrees
 * @param {number} lon - Longitude in degrees
 * @param {number} distance - Distance from earth center
 * @returns {THREE.Vector3}
 */
export function getCameraPositionForLatLon(lat, lon, distance = 2.0) {
  return latLonToVector3(lat, lon, distance);
}
