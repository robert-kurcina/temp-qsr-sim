// /src/data/tokenSpecs.js
export const TOKEN_SPECS = {
  // Status tokens (discs)
  done: { 
    size: { diameter: 18, thickness: 6 }, 
    color: 'blue',
    type: 'status',
    stackable: true,
    svg: 'done-marker.svg'
  },
  wait: { 
    size: { diameter: 18, thickness: 3 }, 
    color: 'white', 
    type: 'status',
    stackable: true,
    svg: 'wait-marker.svg'
  },
  hidden: { 
    size: { diameter: 15.24, thickness: 2 }, 
    color: 'dark',
    type: 'status',
    stackable: true,
    svg: 'hidden-marker.svg'
  },
  
  // Hindrance tokens (discs)
  wound: { 
    size: { diameter: 15.24, thickness: 2 }, 
    color: 'red',
    type: 'hindrance',
    stackable: true,
    svg: 'wound-token.svg'
  },
  delay: { 
    size: { diameter: 15.24, thickness: 2 }, 
    color: 'white',
    type: 'hindrance',
    stackable: true,
    svg: 'delay-token.svg'
  },
  fear: { 
    size: { diameter: 15.24, thickness: 2 }, 
    color: 'yellow',
    type: 'hindrance',
    stackable: true,
    svg: 'fear-token.svg'
  },
  
  // Markers (triangular)
  ko: { 
    size: { base: 15.24, thickness: 2 }, 
    shape: 'triangle',
    type: 'marker',
    stackable: false,
    svg: 'knocked-out-marker-triangle.svg'
  },
  eliminated: { 
    size: { base: 15.24, thickness: 2 }, 
    shape: 'triangle', 
    type: 'marker',
    stackable: false,
    svg: 'eliminated-marker-triangle.svg'
  },
  outOfAmmo: { 
    size: { diameter: 19.05, thickness: 2 }, 
    color: 'white',
    type: 'marker',
    stackable: true,
    svg: 'out-of-ammo-marker.svg'
  }
};

// Resource tokens
export const RESOURCE_TOKENS = {
  initiative: {
    size: { diameter: 31.75, thickness: 2 },
    color: 'gold',
    type: 'resource',
    svg: 'initiative-token.svg'
  },
  victory: {
    size: { diameter: 31.75, thickness: 2 },
    color: 'gold',
    type: 'resource', 
    svg: 'victory-point-token.svg'
  }
};