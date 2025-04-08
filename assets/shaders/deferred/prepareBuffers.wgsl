struct VertexOut {
  @builtin(position) position: vec4f,
  @location(0) texCoords: vec2f,
  @location(1) worldPosition: vec4f,
  @location(2) bitangents: vec3f,
  @location(3) tangents: vec4f,
  @location(4) normals: vec3f,
}

struct Camera {
  projection: mat4x4<f32>,
  view: mat4x4<f32>,
  model: mat4x4<f32>,
  normalMatrix: mat4x4<f32>,
  worldPosition: vec4f,
}

struct Factors {
  mroz: vec4f,
  baseColor: vec4f,
  emissive: vec4f,
}

@group(0) @binding(0) var<uniform> camera: Camera;
@group(0) @binding(1) var<uniform> factors: Factors;

@group(1) @binding(0) var albedoTexture : texture_2d<f32>;
@group(1) @binding(1) var normalTexture : texture_2d<f32>;
@group(1) @binding(2) var emissiveTexture : texture_2d<f32>;
@group(1) @binding(3) var metalicRoughnessTexture : texture_2d<f32>;
@group(1) @binding(4) var aoTexture : texture_2d<f32>;

@group(2) @binding(0) var albedoSampler : sampler;
@group(2) @binding(1) var normalTextureSampler : sampler;
@group(2) @binding(2) var emissiveTextureSampler : sampler;
@group(2) @binding(3) var metalicRoughnessTextureSampler : sampler;
@group(2) @binding(4) var aoTextureSampler : sampler;

@vertex
fn vertex_main(@location(0) position: vec4f, @location(1) texCoords: vec2f, @location(2) normals: vec3f, @location(3) tangents: vec4f) -> VertexOut {
  var out: VertexOut;
  out.position = camera.projection * camera.view * camera.model * position;
  out.texCoords = texCoords;  
  out.worldPosition = camera.model * position;
  out.bitangents = (camera.model * vec4f(cross(tangents.xyz, normals.xyz), 0)).xyz;
  out.tangents = camera.model * vec4f(tangents.xyz, 0);
  out.normals = (camera.model * vec4f(normals, 0)).xyz;

  return out;
}

struct FragmentOut {
  @location(0) albedo: vec4f,
  @location(1) emissive: vec4f,
  @location(2) aoMetalicRoughness: vec4f,
  @location(3) pNormals: vec4f,
  @location(4) worldPosition: vec4f,
  @location(5) vBiTangents: vec4f,
  @location(6) vNormals: vec4f,
  @location(7) vTangents: vec4f,
}

@fragment
fn fragment_main(in: VertexOut) -> FragmentOut {
  var out: FragmentOut;
  var tAlbedo = textureSample(albedoTexture, albedoSampler, in.texCoords.xy) * factors.baseColor;
  var tEmissive = textureSample(emissiveTexture, emissiveTextureSampler, in.texCoords.xy) * factors.emissive;
  var tMetalicRoughness = textureSample(metalicRoughnessTexture, metalicRoughnessTextureSampler, in.texCoords.xy) * vec4f(0, factors.mroz.y, factors.mroz.x, 0);
  var tAo = 1.0 + factors.mroz.z * (textureSample(aoTexture, aoTextureSampler, in.texCoords.xy).r - 1.0);
  var tNormals = textureSample(normalTexture, normalTextureSampler, in.texCoords.xy);

  out.albedo = tAlbedo;
  out.emissive = tEmissive;
  out.aoMetalicRoughness = vec4f(tAo,tMetalicRoughness.gba);
  out.pNormals = tNormals;

  out.worldPosition = in.worldPosition;
  out.vBiTangents = normalize(vec4f(in.bitangents, 0));
  out.vNormals = normalize(vec4f(in.normals, 0));
  out.vTangents = normalize(vec4f(in.tangents.xyz, 0));

  return out;
}