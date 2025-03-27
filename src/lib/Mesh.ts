import { GLB } from "@loaders.gl/gltf";
import _ from 'lodash'

const ACCESSOR_COMPONENT_TYPE_TO_BYTES = {
  5126: 4,
  5125: 4,
  5123: 2,
  5122: 4,
  5121: 1,
  5120: 1,
}

const ACCESSOR_COMPONENT_TYPE_TO_ARRAY_TYPE = {
  5126: Float32Array,
  5125: Uint32Array,
  5123: Uint16Array,
  5122: Int16Array,
  5121: Uint8Array,
  5120: Int8Array,
}

const ACCESSOR_TYPE_TO_COUNT = {
  SCALAR: 1,
  VEC2: 2,
  VEC3: 3,
  VEC4: 4,
  MAT2: 4,
  MAT3: 9,
  MAR4: 16,
}

export default class Mesh {
  private rawGLB: GLB;
  constructor(glb: GLB) {
    this.rawGLB = glb;
    console.log(this.rawGLB)
  }

  private getAccessor(id: number) {
    return this.rawGLB.json.accessors[id]
  }

  private getBufferView(id: number) {
    return this.rawGLB.json.bufferViews[id]
  }

  private resolveAccessorBufferData(accessorId: number) {
    const accessor = this.getAccessor(accessorId)
    const bufferView = this.getBufferView(accessor.bufferView)
    const binChunk = this.rawGLB.binChunks[0];

    //@ts-ignore
    const itemByteSize = ACCESSOR_COMPONENT_TYPE_TO_BYTES[accessor.componentType] * ACCESSOR_TYPE_TO_COUNT[accessor.type]
    //@ts-ignore
    const Type: typeof ACCESSOR_COMPONENT_TYPE_TO_ARRAY_TYPE[keyof typeof ACCESSOR_COMPONENT_TYPE_TO_ARRAY_TYPE] = ACCESSOR_COMPONENT_TYPE_TO_ARRAY_TYPE[accessor.componentType]

    const accessorByteOffset = accessor.byteOffset || 0;
    const bufferViewByteOffset = bufferView.byteOffset || 0;
    const offset = binChunk.byteOffset + bufferViewByteOffset + accessorByteOffset;


    const buffer = binChunk.arrayBuffer.slice(offset, offset + accessor.count * itemByteSize)
    if (buffer.byteLength === 0) debugger;
    return new Type(buffer);
  }

  resolveMeshesToBytes() {
    return this.rawGLB.json.meshes.map((m: any) => {
      const nm = _.cloneDeep(m);
      nm.primitives.forEach((p: any) => {
        Object.entries(p.attributes).forEach(([k, v]) => {
          p.attributes[k] = this.resolveAccessorBufferData(v as number);
        })
        p.indices = this.resolveAccessorBufferData(p.indices);

      })

      return nm
    })
  }



}