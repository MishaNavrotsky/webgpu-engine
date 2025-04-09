import { mat4, vec3 } from "gl-matrix";
import IRenderableObject from "../interfaces/IRenderableObject";
import Material, { BindGroupType } from "../Material";
import MeshData from "../MeshData";
import ModelMatrix from "../../ModelMatrix";
import BuffersData from "../BuffersData";
import { VERTEX_BUFFER_IDS, TEXTURE_SAMPLERS_IDS, INDICES_BUFFER_ID, UNIFORM_BUFFER_IDS, TEXTURE_IDS } from "@/constants";
import GLBMesh from "@/lib/loader/GLBMesh";
import RenderPipeline from "../RenderPipeline";
import Loader from "@/lib/loader";
import _ from 'lodash'

export type RenderableObjectConstructor = {
  id: string,
  meshData: MeshData,
  buffersData: BuffersData,
  material: Material,
  castShadow?: boolean,
  receiveShadows?: boolean,
}


export default class RenderableObject implements IRenderableObject {
  id: string;
  private _s: RenderableObjectConstructor;
  private _cModelMatrix: ModelMatrix = new ModelMatrix();

  constructor(v: RenderableObjectConstructor) {
    this.id = v.id;
    this._s = v;
  }

  getBindGroupsDescriptors(grp: GPURenderPipeline): Array<BindGroupType> {
    const material = this.getMaterial();

    let n = 0;
    const bindGroupDescriptorUniforms = material.uniformBuffers?.length && {
      index: n,
      description: {
        label: "uniforms",
        layout: grp.getBindGroupLayout(n++),
        entries: material.uniformBuffers!.map((b, i): GPUBindGroupEntry => {
          return {
            binding: i, resource: { buffer: b },
          }
        })
      }
    }
    const textures = material.allTextures;
    const bindGroupDescriptorTextures = textures.length && {
      index: n,
      description: {
        label: "textures",
        layout: grp.getBindGroupLayout(n++),
        entries: textures.map((t, i): GPUBindGroupEntry => {
          return {
            binding: i, resource: t!.createView(),
          }
        })
      }
    }

    const samplers = material.allSamplers;
    const bindGroupDescriptorSampler = samplers.length && {
      index: n,
      description: {
        label: "samplers",
        layout: grp.getBindGroupLayout(n++),
        entries: samplers!.map((s, i): GPUBindGroupEntry => {
          return {
            binding: i, resource: s!,
          }
        })
      }
    }

    return [bindGroupDescriptorUniforms, bindGroupDescriptorTextures, bindGroupDescriptorSampler].filter(e => _.isObject(e))
  }

  getBuffersData(): BuffersData {
    return this._s.buffersData;
  }
  getMeshData(): MeshData {
    return this._s.meshData;
  }
  getMaterial(): Material {
    return this._s.material;
  }
  swapMaterial(m: Material): void {
    this._s.material = m;
  }

  get castShadows(): boolean {
    return this._s.castShadow ?? true;
  }
  set castShadows(v: boolean) {
    this._s.castShadow = v;
  }
  get receiveShadows(): boolean {
    return this._s.receiveShadows ?? true;
  }
  set receiveShadows(v: boolean) {
    this._s.receiveShadows = v;
  }

  getModelMatrix(): mat4 {
    return this._cModelMatrix.modelMatrix;
  }
  translate(v: vec3): void {
    this._cModelMatrix.translation = v;
  }
  rotateDeg(v: vec3): void {
    this._cModelMatrix.rotation = v;
  }
  scale(v: vec3): void {
    this._cModelMatrix.scale = v;
  }

  static async createFromGLB(glbMesh: GLBMesh, device: GPUDevice, loader: Loader): Promise<RenderableObject[]> {
    const _generateMaterialsBD = (md: MeshData, primitive: any) => {
      const createGPUTexture = (i: ImageBitmap | undefined, label: string): GPUTexture | undefined => {
        return i && device.createTexture({
          format: 'rgba8unorm',
          usage: GPUTextureUsage.TEXTURE_BINDING |
            GPUTextureUsage.COPY_DST |
            GPUTextureUsage.RENDER_ATTACHMENT,
          size: [i.width, i.height, 1],
          label
        })
      }

      const populateGPUTexture = (i: ImageBitmap | undefined, g: GPUTexture | undefined) => {
        i && g && device.queue.copyExternalImageToTexture({ source: i }, { texture: g }, [i.width, i.height])
      }

      const createGPUBuffer = (d: Float32Array | Uint32Array | undefined, i: GPUBufferUsageFlags, label: string): GPUBuffer | undefined => {
        return d && device.createBuffer({
          size: d.byteLength,
          usage: i,
          label
        })
      };

      const populateGPUBuffer = (b: GPUBuffer | undefined, d: Float32Array | Uint32Array | undefined) => {
        d && b && device.queue.writeBuffer(b, 0, d);
      }

      const verticesBuffer = createGPUBuffer(md.vertecies, GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST, VERTEX_BUFFER_IDS.positionBuffer);
      const indicesBuffer = createGPUBuffer(md.indices, GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST, INDICES_BUFFER_ID)!;
      const texCoordsBuffer = createGPUBuffer(md.texCoords, GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST, VERTEX_BUFFER_IDS.texCoordsBuffer);
      const normalsBuffer = createGPUBuffer(md.normals, GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST, VERTEX_BUFFER_IDS.normalsBuffer)!;
      const tangetsBuffer = createGPUBuffer(md.tangents, GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST, VERTEX_BUFFER_IDS.tangentsBuffer);


      const colorTexture = createGPUTexture(md.textures?.color, TEXTURE_IDS.colorTexture);
      const normalTexture = createGPUTexture(md.textures?.normal, TEXTURE_IDS.normalTexture);
      const emissiveTexture = createGPUTexture(md.textures?.emissive, TEXTURE_IDS.emissiveTexture);
      const metalicRoughnessTexture = createGPUTexture(md.textures?.metalicRoughness!, TEXTURE_IDS.metalicRoughnessTexture);
      const occlusionTexture = createGPUTexture(md.textures?.occlusion!, TEXTURE_IDS.occlusionTexture);

      const colorTextureSampler = colorTexture && device.createSampler({ ...md.samplers?.color, label: TEXTURE_SAMPLERS_IDS.colorSampler });
      const emissiveTextureSampler = emissiveTexture && device.createSampler({ ...md.samplers?.emissive, label: TEXTURE_SAMPLERS_IDS.emissiveSampler });
      const metalicRoughnessTextureSampler = metalicRoughnessTexture && device.createSampler({ ...md.samplers?.metalicRoughness, label: TEXTURE_SAMPLERS_IDS.metalicRoughnessSampler });
      const normalTextureSampler = normalTexture && device.createSampler({ ...md.samplers?.normal, label: TEXTURE_SAMPLERS_IDS.normalSampler });
      const occlusionSampler = occlusionTexture && device.createSampler({ ...md.samplers?.occlusion, label: TEXTURE_SAMPLERS_IDS.occlusionSampler });

      const uniformBuffers: GPUBuffer[] = [
        device.createBuffer({
          size: 4 * 4 * 4 * 4 + 4 * 4,
          usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
          label: UNIFORM_BUFFER_IDS.camera,
        }), //MVP + NM + POS,
        device.createBuffer({
          size: 4 * 4 + 4 * 4 + 4 * 4, //vec4 + vec4 + vec4
          usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
          label: UNIFORM_BUFFER_IDS.pointLights
        }), //point lights
        device.createBuffer({
          size: 4 + 4 + 4 + 4,
          usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
          label: UNIFORM_BUFFER_IDS.settings,
        }) //settings
      ]

      device.queue.writeBuffer(uniformBuffers[2], 0, new Uint32Array([!colorTexture ? 1 : 0, !normalTexture ? 1 : 0, !emissiveTexture ? 1 : 0, !metalicRoughnessTexture ? 1 : 0]))

      populateGPUBuffer(indicesBuffer, md.indices)
      populateGPUBuffer(verticesBuffer, md.vertecies)
      populateGPUBuffer(texCoordsBuffer, md.texCoords)
      populateGPUBuffer(normalsBuffer, md.normals)
      populateGPUBuffer(tangetsBuffer, md.tangents)

      populateGPUTexture(md.textures?.color, colorTexture);
      populateGPUTexture(md.textures?.emissive, emissiveTexture);
      populateGPUTexture(md.textures?.normal, normalTexture);
      populateGPUTexture(md.textures?.metalicRoughness, metalicRoughnessTexture);
      populateGPUTexture(md.textures?.occlusion, occlusionTexture);

      const renderPipeline = new RenderPipeline({
        id: md.id,
        shaderModule: device.createShaderModule({
          code: loader.getShader('main')!,
          label: 'main',
        }),
        cullMode: primitive.material.doubleSided ? 'none' : 'back'
      })

      const material = Material.create({
        id: md.id,
        renderPipeline,
        colorSampler: colorTextureSampler,
        colorTexture: colorTexture,
        emissiveSampler: emissiveTextureSampler,
        emissiveTexture: emissiveTexture,
        metalicRoughnessSampler: metalicRoughnessTextureSampler,
        metalicRoughnessTexture: metalicRoughnessTexture,
        normalSampler: normalTextureSampler,
        normalTexture: normalTexture,
        occlusionSampler,
        occlusionTexture,
        uniformBuffers,
        factors: {
          baseColor: primitive.pbr.baseColorFactor,
          emissive: primitive.emissiveFactor,
          metallic: primitive.pbr.metallicFactor,
          occlusion: primitive.occlusionStrength,
          roughness: primitive.pbr.roughnessFactor,
        }
      }, device)

      const buffersData = BuffersData.create({
        id: md.id,
        indicesBuffer,
        positionBuffer: verticesBuffer!,
        normalsBuffer,
        tangetsBuffer,
        texCoordsBuffer,
      }, device)


      return { material, buffersData };
    }

    const raw = await glbMesh.resolveMeshesToBytes();
    return raw.map((m, i) => {
      const id = m.name;
      const primitive = m.primitives[0]
      const meshData = new MeshData({
        id,
        indices: primitive.indices,
        vertecies: primitive.attributes.POSITION,
        normals: primitive.attributes.NORMAL,
        tangents: primitive.attributes.TANGENT,
        texCoords: primitive.attributes.TEXCOORD_0,
        samplers: {
          color: primitive.colorTexture?.sampler,
          normal: primitive.normalTexture?.sampler,
          emissive: primitive.emissiveTexture?.sampler,
          metalicRoughness: primitive.metallicRoughnessTexture?.sampler,
          occlusion: primitive.occlusionTexture?.sampler
        },
        textures: {
          color: primitive.colorTexture?.image,
          normal: primitive.normalTexture?.image,
          emissive: primitive.emissiveTexture?.image,
          metalicRoughness: primitive.metallicRoughnessTexture?.image,
          occlusion: primitive.occlusionTexture?.image
        }
      })

      const d = _generateMaterialsBD(meshData, primitive)


      const r = new RenderableObject({
        material: d.material,
        buffersData: d.buffersData,
        id: i.toString(),
        meshData,
      })

      return r;
    })
  }
}