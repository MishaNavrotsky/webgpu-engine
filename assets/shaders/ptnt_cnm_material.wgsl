struct VertexOut {
  @builtin(position) position: vec4f,
  @location(0) texCoords: vec2f,
  @location(1) normals: vec3f,
  @location(2) tangents: vec3f,
  @location(3) bitangents: vec3f,
  @location(4) worldPosition: vec3f,
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

@group(1) @binding(0) var colorTexture : texture_2d<f32>;
@group(1) @binding(1) var normalTexture : texture_2d<f32>;
@group(1) @binding(2) var metalicRoughnessTexture : texture_2d<f32>;

@group(2) @binding(0) var colorSampler : sampler;
@group(2) @binding(1) var normalSampler : sampler;
@group(2) @binding(2) var metalicRoughnessSampler : sampler;

@vertex
fn vertex_main(@location(0) position: vec4f, @location(1) texCoords: vec2f, @location(2) normals: vec3f, @location(3) tangents: vec4f) -> VertexOut {
  var out: VertexOut;
  out.position = camera.projection * camera.view * camera.model * position;
  out.texCoords = texCoords;
  out.normals = normals;
  out.tangents = tangents.xyz;
  out.bitangents = tangents.w * cross(out.normals, out.tangents);

  var vertexWorldPosition = camera.model * position;
  out.worldPosition = vertexWorldPosition.xyz;

  return out;
}

@fragment
fn fragment_main(in: VertexOut) -> @location(0) vec4f {
  var color = textureSample(colorTexture, colorSampler, in.texCoords.xy);
  var normalSample = textureSample(normalTexture, normalSampler, in.texCoords.xy);  
  var metalicRoughness = textureSample(metalicRoughnessTexture, metalicRoughnessSampler, in.texCoords.xy);

  var T = normalize((camera.model * vec4(in.tangents,   0.0)).xyz);
  var B = normalize((camera.model * vec4(in.bitangents, 0.0)).xyz);
  var N = normalize((camera.model * vec4(in.normals,    0.0)).xyz);
  var TBN = mat3x3f(T, B, N);

  for(var i: u32 = 0; i < arrayLength(&pointLights); i++) {
    var lightPos = pointLights[i].worldPosition.xyz;
    var s = normalSample.xyz * 2 - 1;
    var d = normalize(TBN * s);

    let lightDist = dot(d, -normalize(in.worldPosition - pointLights[i].worldPosition.xyz)) * pointLights[i].intensityRadiusZZ.x;

    color *= lightDist;

  }

  return color;
}