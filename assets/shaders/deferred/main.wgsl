struct VertexOut {
  @builtin(position) position: vec4f,
  @location(0) texCoords: vec2f,
  @location(1) worldPosition: vec3f,
}

struct Camera {
  projection: mat4x4<f32>,
  view: mat4x4<f32>,
  model: mat4x4<f32>,
}

struct PointLight {
  worldPosition: vec4f,
  color: vec4f,
  intensityRadiusZZ: vec4f,
}

@group(0) @binding(0) var<uniform> camera: Camera;
@group(0) @binding(1) var<storage> pointLights: array<PointLight>;


@group(1) @binding(0) var tAlbedo : texture_2d<f32>;
@group(1) @binding(1) var tEmissive : texture_2d<f32>;
@group(1) @binding(2) var tMetalicRoughness : texture_2d<f32>;
@group(1) @binding(3) var tpNormals : texture_2d<f32>;
@group(1) @binding(4) var tWorldPosition : texture_2d<f32>;
@group(1) @binding(5) var tvBiTangents : texture_2d<f32>;
@group(1) @binding(6) var tvNormals : texture_2d<f32>;
@group(1) @binding(7) var tvTangents : texture_2d<f32>;

@vertex
fn vertex_main(@location(0) position: vec4f, @location(1) texCoords: vec2f) -> VertexOut {
  var out: VertexOut;
  out.position = position;
  out.texCoords = texCoords;

  var d = pointLights[0].color;


  var vertexWorldPosition = camera.model * position;
  out.worldPosition = vertexWorldPosition.xyz;

  return out;
}

@fragment
fn fragment_main(in: VertexOut) -> @location(0) vec4f {
  var pos = vec2i(floor(in.position.xy));

  var albedo = textureLoad(tAlbedo, pos, 0);
  var emissive = textureLoad(tEmissive, pos, 0);
  var metalicRoughness = textureLoad(tMetalicRoughness,  pos, 0);
  var pNormals = textureLoad(tpNormals, pos, 0);
  var worldPosition = textureLoad(tWorldPosition, pos, 0);
  var vBiTangents = textureLoad(tvBiTangents, pos, 0);
  var vNormals = textureLoad(tvNormals, pos, 0);
  var vTangents = textureLoad(tvTangents, pos, 0);

  return albedo;
}