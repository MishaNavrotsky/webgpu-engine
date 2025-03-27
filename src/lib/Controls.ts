export default class Controls {
  private keysMap: Map<string, boolean> = new Map();
  constructor() {
    document.addEventListener('keydown', (e) => {
      this.keysMap.set(e.key.toLowerCase(), true)
    })
    document.addEventListener('keyup', (e) => {
      this.keysMap.delete(e.key.toLowerCase())
    })
    document.addEventListener('mouseout', (e) => {
      this.keysMap.clear();
    })
  }

  has(input: string): boolean {
    return this.keysMap.has(input);
  }
}