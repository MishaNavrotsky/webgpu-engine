export default class Controls {
  private keysMap: Map<string, boolean> = new Map();
  private _mousePos: [number, number] = [0, 0]
  private _dMousePos: [number, number] = [0, 0]
  subscribe() {
    document.addEventListener('keydown', (e) => {
      this.keysMap.set(e.key.toLowerCase(), true)
    })
    document.addEventListener('keyup', (e) => {
      this.keysMap.delete(e.key.toLowerCase())
    })
    document.addEventListener('mouseout', (e) => {
      this.keysMap.clear();
    })

    document.addEventListener('mousemove', (e) => {
      this._mousePos = [e.clientX, e.clientY]
      this._dMousePos = [this._dMousePos[0] + e.movementX, this._dMousePos[1] + e.movementY];

    })
  }

  keyPressed(input: string): boolean {
    return this.keysMap.has(input);
  }

  get mousePos() {
    return [...this._mousePos];
  }

  get dMousePos() {
    return [...this._dMousePos];
  }

  clearDeltaMouse() {
    this._dMousePos = [0, 0];
  }
}