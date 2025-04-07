type VertexBuffersStateGeneratorAdd = {
  offset?: GPUVertexAttribute['offset'],
  format: GPUVertexAttribute['format'],
  arrayStride?: GPUVertexBufferLayout['arrayStride'],
  stepMode?: GPUVertexBufferLayout['stepMode'],
}


const FORMAT_TO_ARRAY_STRIDE: { [key in GPUVertexAttribute['format']]: number } = {
  float32: 4,
  float32x2: 8,
  float32x3: 12,
  float32x4: 16,

  uint8: 1,
  uint8x2: 2,
  uint8x4: 4,
  sint8: 1,
  sint8x2: 2,
  sint8x4: 4,
  unorm8: 1,
  unorm8x2: 2,
  unorm8x4: 4,
  snorm8: 1,
  snorm8x2: 2,
  snorm8x4: 4,
  uint16: 2,
  uint16x2: 4,
  uint16x4: 8,
  sint16: 2,
  sint16x2: 4,
  sint16x4: 8,
  unorm16: 2,
  unorm16x2: 4,
  unorm16x4: 8,
  snorm16: 2,
  snorm16x2: 4,
  snorm16x4: 8,
  float16: 2,
  float16x2: 4,
  float16x4: 8,
  uint32: 4,
  uint32x2: 8,
  uint32x3: 12,
  uint32x4: 16,
  sint32: 4,
  sint32x2: 8,
  sint32x3: 12,
  sint32x4: 16,
  "unorm10-10-10-2": 0,
  "unorm8x4-bgra": 0
}

export default class VertexBuffersStateGenerator {
  private _shaderLocation = 0;
  private _vbs: (GPUVertexBufferLayout & { label: string })[] = []
  private _ended = false;
  add(label: string, s: VertexBuffersStateGeneratorAdd, skip: boolean) {
    if (this._ended) throw 'Vertex Buffers State Generator ended'
    if (skip) return this;

    const layout: GPUVertexBufferLayout = {
      arrayStride: FORMAT_TO_ARRAY_STRIDE[s.format],
      stepMode: s.stepMode || 'vertex',
      attributes: [
        {
          format: s.format,
          offset: s.offset || 0,
          shaderLocation: this._shaderLocation++,
        }
      ]
    }
    this._vbs.push({ ...layout, label });
    return this;
  }

  end() {
    this._ended = true;

    return this._vbs;
  }
}