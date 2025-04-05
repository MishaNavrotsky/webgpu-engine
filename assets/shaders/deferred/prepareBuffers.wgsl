struct VertexOut {
  @builtin(position) position: vec4f,
  @location(0) texCoords: vec2f,
  @location(1) worldPosition: vec3f,
  @location(2) bitangents: vec3f,
  @location(3) tangents: vec4f,
  @location(4) normals: vec3f,
}

struct Camera {
  projection: mat4x4<f32>,
  view: mat4x4<f32>,
  model: mat4x4<f32>,
}

@group(0) @binding(0) var<uniform> camera: Camera;

@group(1) @binding(0) var albedoTexture : texture_2d<f32>;
@group(1) @binding(1) var normalTexture : texture_2d<f32>;
@group(1) @binding(2) var emissiveTexture : texture_2d<f32>;
@group(1) @binding(3) var metalicRoughnessTexture : texture_2d<f32>;

@group(2) @binding(0) var albedoSampler : sampler;
@group(2) @binding(1) var normalTextureSampler : sampler;
@group(2) @binding(2) var emissiveTextureSampler : sampler;
@group(2) @binding(3) var metalicRoughnessTextureSampler : sampler;

@vertex
fn vertex_main(@location(0) position: vec4f, @location(1) texCoords: vec2f, @location(2) normals: vec3f, @location(3) tangents: vec4f) -> VertexOut {
  var out: VertexOut;
  out.position = camera.projection * camera.view * camera.model * position;
  out.texCoords = texCoords;  
  out.worldPosition = (camera.model * position).xyz;
  out.bitangents = tangents.w * cross(normals.xyz, tangents.xyz);
  out.tangents = tangents;
  out.normals = normals;

  return out;
}

struct FragmentOut {
  @location(0) albedo: vec4f,
  @location(1) emissive: vec4f,
  @location(2) metalicRoughness: vec4f,
  @location(3) pNormals: vec4f,
  @location(4) worldPosition: vec4f,
  @location(5) vBiTangents: vec4f,
  @location(6) vNormals: vec4f,
  @location(7) vTangents: vec4f,
}

@fragment
fn fragment_main(in: VertexOut) -> FragmentOut {
  var out: FragmentOut;
  var tAlbedo = textureSample(albedoTexture, albedoSampler, in.texCoords.xy);
  var tEmissive = textureSample(emissiveTexture, emissiveTextureSampler, in.texCoords.xy);
  var tMetalicRoughness = textureSample(metalicRoughnessTexture, metalicRoughnessTextureSampler, in.texCoords.xy);
  var tNormals = textureSample(normalTexture, normalTextureSampler, in.texCoords.xy);

  out.albedo = tAlbedo;
  out.emissive = tEmissive;
  out.metalicRoughness = tMetalicRoughness;
  out.pNormals = tNormals;

  out.worldPosition = vec4f(in.worldPosition, 0);
  out.vBiTangents = vec4f(in.bitangents, 0);
  out.vNormals = vec4f(in.normals, 0);
  out.vTangents = in.tangents;

  return out;
}