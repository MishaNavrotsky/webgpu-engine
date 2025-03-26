import { glMatrix, mat4, vec3 } from "gl-matrix";
import _ from 'lodash'

const vUp = vec3.create()
vUp[1] = 1;

class Camera {
  private view: mat4 = mat4.create();
  private projection: mat4 = mat4.create();
  private lookVector: vec3 = [0, 0, 1];
  private translateVector: vec3 = vec3.create();

  constructor(width: number, height: number, fov: number = 90) {
    this.setPerspective(width, height, fov)
  }

  setPerspective(width: number, height: number, fov: number = 90) {
    mat4.perspectiveZO(this.projection, glMatrix.toRadian(fov), width / height, 0, Infinity);
    // mat4.orthoZO(this.projection, -2, -2, -2, 2, 0, Infinity);

  }

  lookAt(v: vec3) {
    vec3.copy(this.lookVector, v);
  }

  get position(): vec3 {
    return vec3.clone(this.translateVector);
  }

  set position(v: vec3) {
    this.translateVector = vec3.clone(v);
  }

  get viewMatrix(): mat4 {
    const cloneView = mat4.clone(this.view);
    const cloneTranslateVector = vec3.clone(this.translateVector);
    const cloneLookVector = vec3.clone(this.lookVector);
    return mat4.lookAt(cloneView, this.translateVector, vec3.add(cloneTranslateVector, cloneTranslateVector, cloneLookVector), vUp);
  }

  get projectionMatrix(): mat4 {
    const cloneProjection = mat4.clone(this.projection);

    return cloneProjection;
  }

  get look(): vec3 {
    return vec3.clone(this.lookVector);
  }
}

export default Camera