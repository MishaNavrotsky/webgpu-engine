import { GLB } from "@loaders.gl/gltf";
import _ from 'lodash'
import PQueue from "p-queue";

const q = new PQueue({ concurrency: 1 })

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

const SAMPLER_TO_GPU_SAMPLER_DESCRIPTOR = {
  9729: 'linear',
  9728: 'nearest',
  9986: 'nearest',
  9987: 'linear',
  9984: 'nearest',
  9985: 'linear',
  10497: 'repeat',
  33071: 'clamp-to-edge',
  33648: 'mirror-repeat'
}

export default class GLBMesh {
  private _rawGLB: GLB;
  constructor(glb: GLB) {
    this._rawGLB = glb;
  }

  private getAccessor(id: number) {
    return this._rawGLB.json.accessors[id]
  }

  private getBufferView(id: number) {
    return this._rawGLB.json.bufferViews[id]
  }

  private getMaterial(id: number) {
    return this._rawGLB.json.materials[id];
  }

  private resolveAccessorBufferData(accessorId: number) {
    const accessor = this.getAccessor(accessorId)
    const bufferView = this.getBufferView(accessor.bufferView)
    const binChunk = this._rawGLB.binChunks[0];

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

  private resolveSampler(sampler: any): GPUSamplerDescriptor {
    return {
      //@ts-ignore
      magFilter: SAMPLER_TO_GPU_SAMPLER_DESCRIPTOR[sampler.magFilter],
      //@ts-ignore
      minFilter: SAMPLER_TO_GPU_SAMPLER_DESCRIPTOR[sampler.minFilter],
      //@ts-ignore
      addressModeU: SAMPLER_TO_GPU_SAMPLER_DESCRIPTOR[sampler.wrapS || 10497],
      //@ts-ignore
      addressModeV: SAMPLER_TO_GPU_SAMPLER_DESCRIPTOR[sampler.wrapT || 10497],
    }
  }

  private async resolveTextureByMaterial(materialId: number, texturePath: string) {
    const material = this.getMaterial(materialId);
    if (!material) return;
    const textureId = _.get(material, texturePath);
    if (!_.isNumber(textureId)) return;



    const texture = this._rawGLB.json.textures[textureId];
    const sampler = this._rawGLB.json.samplers[texture.sampler]
    const textureSource = texture.source;
    const image = this._rawGLB.json.images[textureSource];
    const bufferView = this.getBufferView(image.bufferView)

    const binChunk = this._rawGLB.binChunks[0];
    const bufferViewByteOffset = bufferView.byteOffset || 0;
    const offset = binChunk.byteOffset + bufferViewByteOffset;

    const buffer = binChunk.arrayBuffer.slice(offset, offset + bufferView.byteLength);
    const blob = new Blob([buffer], { type: image.mimeType });
    const url = URL.createObjectURL(blob);
    const img = document.createElement('img');
    img.src = url;
    await q.add(() => img.decode());
    return { image: await createImageBitmap(img), sampler: this.resolveSampler(sampler) }
  }

  async resolveMeshesToBytes() {
    const values = await Promise.all(this._rawGLB.json.meshes.map(async (m: any) => {
      const nm = _.cloneDeep(m);
      for (let p of nm.primitives) {
        Object.entries(p.attributes).forEach(([k, v]) => {
          p.attributes[k] = this.resolveAccessorBufferData(v as number);
        })
        const material = this.getMaterial(p.material)
        p.pbr = { ...material.pbrMetallicRoughness }

        p.pbr.metallicFactor = p.pbr.metallicFactor ?? 1
        p.pbr.roughnessFactor = p.pbr.roughnessFactor ?? 1
        p.pbr.baseColorFactor = p.pbr.baseColorFactor ?? [1, 1, 1, 1]
        p.emissiveFactor = material.emissiveFactor || [0, 0, 0]
        p.occlusionStrength = material.occlusionTexture?.strength ?? 1

        p.indices = this.resolveAccessorBufferData(p.indices);
        p.colorTexture = await this.resolveTextureByMaterial(p.material, 'pbrMetallicRoughness.baseColorTexture.index');
        p.normalTexture = await this.resolveTextureByMaterial(p.material, 'normalTexture.index');
        p.emissiveTexture = await this.resolveTextureByMaterial(p.material, 'emissiveTexture.index');
        p.metallicRoughnessTexture = await this.resolveTextureByMaterial(p.material, 'pbrMetallicRoughness.metallicRoughnessTexture.index');
        p.occlusionTexture = await this.resolveTextureByMaterial(p.material, 'occlusionTexture.index');

        p.material = material;
      }

      return nm
    }))
    return values
  }



}