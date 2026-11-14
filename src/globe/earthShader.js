/**
 * src/globe/earthShader.js
 *
 * Custom shader blending NASA Blue Marble (day) and NASA Black Marble (night)
 * with a dynamic sun angle, twilight terminator, and ocean specular sheen.
 */

import * as THREE from 'three';

export function createEarthMaterial({ dayTexture, nightTexture, sunDirection }) {
  const uniforms = {
    dayTexture: { value: dayTexture },
    nightTexture: { value: nightTexture },
    sunDirection: { value: sunDirection ? sunDirection.clone().normalize() : new THREE.Vector3(1.0, 0.4, 0.8).normalize() },
  };

  const vertexShader = `
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vWorldPosition;

    void main() {
      vUv = uv;
      vNormal = normalize(mat3(modelMatrix) * normal); // world space, same as sunDirection
      vec4 worldPos = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPos.xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  const fragmentShader = `
    uniform sampler2D dayTexture;
    uniform sampler2D nightTexture;
    uniform vec3 sunDirection;

    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vWorldPosition;

    void main() {
      vec3 normal = normalize(vNormal);
      vec3 lightDir = normalize(sunDirection);
      vec3 viewDir = normalize(cameraPosition - vWorldPosition);

      // Dot product for sunlight: 1.0 = direct noon sun, -1.0 = midnight
      float sunDot = dot(normal, lightDir);

      // Smoothstep across terminator zone
      float dayFactor = smoothstep(-0.12, 0.18, sunDot);

      vec4 dayColor = texture2D(dayTexture, vUv);
      vec4 nightColor = texture2D(nightTexture, vUv);

      // Boost city lights contrast and brightness on night side
      vec3 nightLights = nightColor.rgb * 1.5;
      // Faint ambient light on night side so Earth continents remain subtly recognizable
      vec3 nightAmbient = dayColor.rgb * 0.05 + vec3(0.01, 0.015, 0.03);
      vec3 nightFinal = max(nightLights, nightAmbient);

      // Ocean specular highlight for day side
      vec3 halfDir = normalize(lightDir + viewDir);
      float specBase = max(dot(normal, halfDir), 0.0);
      // Mask specular on land: water in Blue Marble has lower red & higher blue/darkness
      float isWater = clamp((dayColor.b - dayColor.r * 0.8) * 2.0, 0.0, 1.0);
      float specular = pow(specBase, 32.0) * isWater * 0.45 * dayFactor;

      // Subtle atmospheric sunset rim along the terminator (-0.1 to 0.15)
      float sunsetBand = smoothstep(-0.15, 0.0, sunDot) * (1.0 - smoothstep(0.0, 0.18, sunDot));
      vec3 sunsetGlow = vec3(0.9, 0.45, 0.2) * sunsetBand * 0.35;

      vec3 blended = mix(nightFinal, dayColor.rgb, dayFactor);
      vec3 finalColor = blended + vec3(specular) + sunsetGlow;

      gl_FragColor = vec4(finalColor, 1.0);
      #include <colorspace_fragment>
    }
  `;

  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
  });
}
