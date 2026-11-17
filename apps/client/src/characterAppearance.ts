import type {TransformNode} from './babylon';
/** Animated clones own their submeshes; hide office headgear without changing shared geometry/materials. */
export function dressOfficeCharacter(root:TransformNode){
 for(const mesh of root.getChildMeshes())for(const part of mesh.subMeshes??[])if(part.getMaterial()?.name==='Hat'){part.indexCount=0;part.verticesCount=0;}
}
