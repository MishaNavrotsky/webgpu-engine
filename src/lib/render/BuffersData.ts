import { TEXTURE_SAMPLERS_IDS, VERTEX_BUFFER_IDS, TEXTURE_IDS, VERTEX_BUFFER_SIZES, VBS_DEF_SEQUENCE, TEX_DEF_SEQUENCE, SAMPLERS_DEF_SEQUENCE } from "@/constants";
import _ from 'lodash';

export type BuffersDataConstructor = {
  id: string,
  positionBuffer: GPUBuffer,
  indicesBuffer: GPUBuffer,
  normalsBuffer?: GPUBuffer,
  texCoordsBuffer?: GPUBuffer,
  tangetsBuffer?: GPUBuffer,
  vertexBuffers?: Array<GPUBuffer>,
}

export default class BuffersData {
  private _settings: BuffersDataConstructor;

  constructor(settings: BuffersDataConstructor) {
    this._settings = settings;
  }

  get vertexBuffers() {
    return this._settings.vertexBuffers;
  }

  get indicesBuffer() {
    return this._settings.indicesBuffer;
  }

  get normalsBuffer() {
    return this._settings.normalsBuffer;
  }

  get texCoordsBuffer() {
    return this._settings.texCoordsBuffer;
  }

  get tangentsBuffer() {
    return this._settings.tangetsBuffer;
  }

  get positionBuffer() {
    return this._settings.positionBuffer;
  }

  get allBuffers() {
    return [...VBS_DEF_SEQUENCE.map(id => this[id]), ...this._settings.vertexBuffers || []]
  }

  get id() {
    return this._settings.id;
  }

  static _initialized = false;
  static _zeroedBuffers: { [key in keyof typeof VERTEX_BUFFER_IDS]: GPUBuffer };


  static setContext(device: GPUDevice) {
    if (this._initialized) return
    const bufSettings = (label: string, size: number): GPUBufferDescriptor => ({
      size,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      label,
    })

    this._zeroedBuffers = {
      normalsBuffer: device.createBuffer(bufSettings(VERTEX_BUFFER_IDS.normalsBuffer, VERTEX_BUFFER_SIZES.normalsBuffer)),
      texCoordsBuffer: device.createBuffer(bufSettings(VERTEX_BUFFER_IDS.texCoordsBuffer, VERTEX_BUFFER_SIZES.texCoordsBuffer)),
      tangentsBuffer: device.createBuffer(bufSettings(VERTEX_BUFFER_IDS.tangentsBuffer, VERTEX_BUFFER_SIZES.tangetsBuffer)),
      positionBuffer: device.createBuffer(bufSettings(VERTEX_BUFFER_IDS.positionBuffer, VERTEX_BUFFER_SIZES.positionBuffer))
    }

    device.queue.writeBuffer(this._zeroedBuffers.normalsBuffer, 0, new Float32Array([0, 0, 0]))
    device.queue.writeBuffer(this._zeroedBuffers.positionBuffer, 0, new Float32Array([0, 0, 0]))
    device.queue.writeBuffer(this._zeroedBuffers.tangentsBuffer, 0, new Float32Array([0, 0, 0, 0]))
    device.queue.writeBuffer(this._zeroedBuffers.texCoordsBuffer, 0, new Float32Array([0, 0]))

    this._initialized = true;
  }

  static create(s: BuffersDataConstructor, device: GPUDevice): BuffersData {
    this.setContext(device);
    const mSettings: BuffersDataConstructor = {
      ...s,
      normalsBuffer: s.normalsBuffer || this._zeroedBuffers.normalsBuffer,
      tangetsBuffer: s.tangetsBuffer || this._zeroedBuffers.tangentsBuffer,
      texCoordsBuffer: s.texCoordsBuffer || this._zeroedBuffers.texCoordsBuffer,
    }

    return new BuffersData(mSettings)
  }
}