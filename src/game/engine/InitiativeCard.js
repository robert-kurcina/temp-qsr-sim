// /src/engine/InitiativeCard.js
export class InitiativeCard {
  constructor(scene) {
    this.scene = scene;
    this.currentHolder = null; // 'side-a' or 'side-b'
    this.cardMesh = null;
  }
  
  /**
   * Create two-sided initiative card
   */
  createCard() {
    // Front face (your provided SVG)
    const frontTexture = this.loadSVGTexture('initiative-card-front.svg');
    // Back face (your provided SVG)  
    const backTexture = this.loadSVGTexture('initiative-card-back.svg');
    
    const geometry = new THREE.PlaneGeometry(63.5 * 0.001, 88.9 * 0.001); // Convert mm to meters
    const material = new THREE.MeshBasicMaterial({ 
      map: frontTexture,
      side: THREE.DoubleSide
    });
    
    // For two-sided rendering, use custom shader or flip on use
    this.cardMesh = new THREE.Mesh(geometry, material);
    this.scene.add(this.cardMesh);
    
    this.updateCardPosition();
  }
  
  /**
   * Transfer card to new holder
   */
  transferTo(side) {
    this.currentHolder = side;
    this.updateCardPosition();
    
    // Flip card to show appropriate side
    this.updateCardOrientation();
  }
  
  /**
   * Position card at player's battlefield edge
   */
  updateCardPosition() {
    if (!this.cardMesh) return;
    
    const x = this.currentHolder === 'side-a' ? -20 : 20;
    const y = 20;
    this.cardMesh.position.set(x, y, 0.1);
  }
}