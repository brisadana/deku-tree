/**
 * Every tunable number of the hero lives here.
 *
 * The object is mutable on purpose: frame loops read it every frame, and the
 * `?debug=1` GUI writes straight into it. Values marked (reload) are read once
 * at startup, so change them here and refresh.
 *
 * Units: metres, seconds, degrees (unless the name says otherwise).
 * Colours are display (sRGB) hex — what you want to see on screen.
 */
export const heroConfig = {
  camera: {
    desktop: { fov: 35, position: [0, 7, 46] as [number, number, number], target: [0, 10.5, 0] as [number, number, number] },
    mobile: { fov: 50, position: [0, 6.5, 44] as [number, number, number], target: [0, 10, 0] as [number, number, number] },
    /** Below this viewport width (px) the mobile framing is used. */
    mobileBreakpoint: 768,
    near: 0.5,
    far: 900,
  },

  renderer: {
    /** dpr caps (reload). */
    dprDesktop: 2,
    dprMobile: 1.5,
    /** ACES filmic tone mapping exposure. Palette colours are compensated for it. */
    exposure: 1.0,
    /** MSAA samples on the post target (0 = rely on SMAA). */
    multisampling: 0,
  },

  models: {
    forest: '/models/deku-forest.glb',
    tree: '/models/deku-tree.glb',
    dracoPath: '/draco/',
  },

  tree: {
    /** Bounding-box height after normalisation (reload). */
    height: 24,
    /** Extra yaw applied to the model so its mouth faces +Z. */
    rotationY: 0,
    /** Fine offset of the whole tree after centring. */
    offset: [0, 0, 0] as [number, number, number],
    /** Canopy sway: amplitude (m) at the top, speed. Starts at canopyStart × height. */
    canopySway: 0.12,
    canopySwaySpeed: 0.35,
    canopyStart: 0.55,
    /** Trunk breathing: radial push (m), period (s), fades out above trunkTop × height. */
    breathAmount: 0.05,
    breathPeriod: 6,
    trunkTop: 0.5,
  },

  sky: {
    radius: 450,
    horizon: '#F5DFA6',
    mid: '#CFE3C4',
    zenith: '#7FB6C2',
    /** Elevation (0 = horizon, 1 = zenith) where the sage band peaks. */
    midHeight: 0.1,
    /** Elevation where the sky is fully teal. The hero frame only reaches ~0.4. */
    zenithHeight: 0.5,
    /** Exponent shaping the mid → zenith blend (higher = teal stays higher). */
    zenithPower: 0.9,
    /** Where the soft sun glow sits, as a direction from the camera. */
    sunDir: [-0.28, 0.42, -1] as [number, number, number],
    sunColor: '#FFF1C8',
    /** Wide halo and tighter core (cosine falloff exponents) and strengths. */
    sunHaloPower: 7,
    sunHalo: 0.22,
    sunCorePower: 48,
    sunCore: 0.9,
    /** Core is pushed above 1 so only it blooms. */
    sunHdr: 2.2,
    cloudColor: '#FFF7E4',
    cloudShade: '#D9D2B8',
    /** Two layers: [near, far]. scale = noise frequency, speed = drift (units/s). */
    clouds: [
      { scale: 1.1, speed: 0.012, coverage: 0.55, softness: 0.26, opacity: 0.38 },
      { scale: 2.2, speed: 0.005, coverage: 0.57, softness: 0.3, opacity: 0.24 },
    ],
    /** Clouds fade in above this elevation and out near the zenith. */
    cloudLow: 0.02,
    cloudHigh: 0.7,
    /** How much the sky turns compared to the world (depth parallax). */
    parallaxFactor: 0.3,
  },

  fog: {
    color: '#F5DFA6',
    /** View depth (m). The tree sits ~46 m away; the forest edge starts ~95 m. */
    near: 55,
    far: 105,
  },

  light: {
    sunColor: '#FFE2A0',
    sunIntensity: 3.2,
    /** Sun light position (it shines toward the origin). Behind-left-above. */
    sunPosition: [-26, 34, -38] as [number, number, number],
    hemiSky: '#CFE3C4',
    hemiGround: '#2F5D4A',
    hemiIntensity: 1.6,
    /** Shadow camera half-size (m) around the clearing (reload). */
    shadowExtent: 20,
    shadowMapSize: 2048,
    shadowBias: -0.0004,
    shadowNormalBias: 0.04,
    shadowRadius: 6,
  },

  forest: {
    /** Foliage wind: amplitude per metre of height, speed, spatial frequency. */
    windAmp: 0.012,
    windSpeed: 0.6,
    windFreq: 0.08,
    /** Slight warm/cool multiply on the forest textures (display hex). */
    tint: '#FFFFFF',
  },

  parallax: {
    yaw: 3,
    pitch: 1.2,
    /** Critically-damped spring stiffness (higher = snappier). */
    stiffness: 4.5,
    /** Seconds to ease back to centre after the pointer leaves the window. */
    returnTime: 1.5,
    /** Touch fallback: idle drift amplitude (0..1 of max) and period (s). */
    idleAmount: 0.35,
    idlePeriod: 22,
    /** Device orientation: degrees of tilt for full deflection. */
    tiltRange: 20,
  },

  grass: {
    /** Blade counts (reload). */
    countDesktop: 30000,
    countMobile: 8000,
    /** Placement area (reload). */
    ringRadius: 17,
    trunkRadius: 7.5,
    pathHalfWidth: 1.6,
    /** Density falloff: probability multiplier at the far side of the meadow (0..1). */
    farDensity: 0.35,
    bladeHeight: 0.55,
    bladeHeightJitter: 0.45,
    bladeWidth: 0.06,
    baseColor: '#1E3B22',
    tipColor: '#B9D57A',
    /** Per-blade hue/value variation 0..1. */
    variation: 0.35,
    windStrength: 0.22,
    windSpeed: 0.55,
    /** Size of the gust pattern (m) and how fast gusts travel across the meadow. */
    gustScale: 14,
    gustSpeed: 2.2,
    /** Cursor push. */
    cursorRadius: 2.5,
    cursorStrength: 0.9,
    /** Trail length (frames sampled) and how long a parting stays open (s). */
    trailPoints: 16,
    trailSpacing: 0.05,
    trailLife: 1.4,
    /** Spring back: damping and oscillation frequency of the overshoot. */
    springDamping: 3.2,
    springFreq: 9,
  },

  blades: {
    poolSize: 120,
    /** Max spawns per 100 ms, and cursor speed (m/s on the ground) for that rate. */
    maxPer100ms: 3,
    speedForMax: 9,
    /** Below this ground speed (m/s) nothing spawns. */
    minSpeed: 1.2,
    lifeMin: 2,
    lifeMax: 4,
    upImpulse: 2.6,
    alongImpulse: 0.35,
    gravity: 3.2,
    drag: 1.6,
    curlStrength: 1.2,
    curlScale: 0.35,
    spin: 5,
    size: 0.22,
    /** Fraction that are leaves rather than blades. */
    leafRatio: 0.3,
  },

  eyes: {
    /** In the tree's normalised frame (base at y=0, face toward +Z). */
    left: { position: [-1.2, 7.8, 4.2] as [number, number, number], rotation: [0, 0, -12] as [number, number, number] },
    right: { position: [1.6, 7.8, 4.2] as [number, number, number], rotation: [0, 0, 12] as [number, number, number] },
    width: 1.4,
    height: 0.55,
    /** Bend radius so the eye follows the bark. */
    curveRadius: 4,
    core: '#F4C95D',
    amber: '#5A3108',
    /** Emissive multiplier when fully open (above bloom threshold). */
    glow: 3.2,
    /** Glow during a drowsy blink. */
    drowsyGlow: 1.2,
    pupilShift: 0.15,
    pupilSize: 0.22,
    pupilDamping: 6,
    timing: {
      drowsyEveryMin: 6,
      drowsyEveryMax: 10,
      drowsyOpen: 0.15,
      drowsyRise: 1.2,
      drowsyHold: 0.5,
      drowsyFall: 1.5,
      wake: 0.7,
      focusDelay: 0.25,
      idleBeforeSleep: 1.5,
      close: 2.5,
      blinkEveryMin: 3,
      blinkEveryMax: 7,
      blink: 0.15,
    },
  },

  entrance: {
    skyFade: 1.2,
    sceneDelay: 0.35,
    sceneFade: 1.4,
    overlayDelay: 0.6,
  },

  post: {
    bloomThreshold: 1.0,
    bloomSmoothing: 0.2,
    bloomIntensity: 0.9,
    bloomRadius: 0.7,
    vignetteOffset: 0.3,
    vignetteDarkness: 0.55,
    /** Depth of field: focus distance (m from camera), range, blur. */
    dofFocus: 34,
    dofRange: 30,
    dofBokeh: 1.4,
  },
}

export type HeroConfig = typeof heroConfig
