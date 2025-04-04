struct VertexOut {
  @builtin(position) position: vec4f,
  @location(0) bitangents: vec3f,
}

struct Camera {
  projection: mat4x4<f32>,
  view: mat4x4<f32>,
  model: mat4x4<f32>,
}

@group(0) @binding(0) var<uniform> camera: Camera;

@vertex
fn vertex_main(@location(0) position: vec4f, @location(1) normals: vec4f, @location(2) tangents: vec4f ) -> VertexOut {
  var out: VertexOut;
  out.position = camera.projection * camera.view * camera.model * position;
  out.bitangents = tangents.w * cross(normals.xyz, tangents.xyz);

  return out;
}

@fragment
fn fragment_main(in: VertexOut) -> @location(0) vec4f {
  return vec4f(in.bitangents, 1.0);
}