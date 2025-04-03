import { vec3, vec4 } from "gl-matrix";

export function vec3toXYZ(v: vec3) {
  return {
    x: v[0],
    y: v[1],
    z: v[2],
  }
}

export function XYZtoVec3(v: { x: number, y: number, z: number }) {
  return vec3.fromValues(v.x, v.y, v.z)
}

export function vec4toXYZW(v: vec3) {
  return {
    x: v[0],
    y: v[1],
    z: v[2],
    w: v[3],
  }
}

export function XYZWtoVec4(v: { x: number, y: number, z: number, w: number }) {
  return vec4.fromValues(v.x, v.y, v.z, v.w)
}