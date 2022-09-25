import React from "react";
import * as THREE from 'three';
import { Font, FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import ThreejsOverlayView from '@ubilabs/threejs-overlay-view';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshLine, MeshLineMaterial } from 'three.meshline'
import { Keyframe } from "../../typings";
import { Scene, Vector3 } from "three";

interface MapProps {
    zoom: number;
    mapId?: string;
    keyframes: Keyframe[];
}

const PERSON_MODEL_FRONT = new THREE.Vector3(0, 0, 1);
const CAR_MODEL_FRONT = new THREE.Vector3(0, 0, 1);
const BIKE_MODEL_FRONT = new THREE.Vector3(0, 0, 1);

const ACTIVITY_TO_MODEL: Record<Keyframe['activity'], {
    name: string,
    front: THREE.Vector3,
    scale: number,
}> = {
    'walking': {
        name: 'person.glb',
        front: PERSON_MODEL_FRONT,
        scale: 2,
    },
    'running': {
        name: 'person.glb',
        front: PERSON_MODEL_FRONT,
        scale: 2,
    },
    'cycling': {
        name: '1.glb',
        front: BIKE_MODEL_FRONT,
        scale: 2,
    },
    'driving': {
        name: 'car.glb',
        front: CAR_MODEL_FRONT,
        scale: 5,
    },
    'UNKNOWN': {
        name: 'person.glb',
        front: PERSON_MODEL_FRONT,
        scale: 2,
    },
}

const ACTIVITY_TO_ANIMATION_INDEX: Record<Keyframe['activity'], number | undefined> = {
    'walking': 6,
    'running': 3,
    'UNKNOWN': 0,
    'cycling': undefined,
    'driving': undefined,
}

function getUncertainity(radius = 1, radialSegments = 16, opacity = 0.6, color = 0x4285f4) {
    const material = new THREE.MeshBasicMaterial({
        wireframe: false, transparent: true, opacity: opacity,
        color: color
    });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, radialSegments, radialSegments), material);
    //const mesh = new THREE.Mesh (new THREE.SphereGeometry( 15, 32, 16 ), material);
    mesh.rotation.x = 90 * Math.PI / 180;
    return mesh;
}

const getPoisitions = (points: THREE.Vector3[]) => {
    const positions = new Float32Array(points.length * 3);
  
    for (let i = 0; i < points.length; i++) {
        points[i]?.toArray(positions, 3 * i);
    }
  
    return positions;
}

const COLORS = [
    0x4285f4,
    0xf4b142,
]

const Map: React.FC<MapProps> = ({ zoom, mapId = '949ef5dcea77455', keyframes = [] }) => {
    const ref = React.useRef<HTMLDivElement>(null);
    const [map, setMap] = React.useState<google.maps.Map>();

    const center = React.useMemo(() => ({
        lat: keyframes[0]?.lat || 0,
        lng: keyframes[0]?.lng || 0,
    }), [keyframes]);

    // Здесь запускаем 3d слой
    const initWebGLOverlay = React.useCallback((map: google.maps.Map) => {
        const overlay = new ThreejsOverlayView(center);
        let loader: GLTFLoader;
        let clock: THREE.Clock;
        let font: Font;
        const objects: Record<string, {
            model: THREE.Group,
            animation?: THREE.AnimationMixer,
            unSphere?: THREE.Mesh,
            scale: number,
            // line: Line2,
            front: THREE.Vector3,
            group: THREE.Group,
            // points: THREE.Vector3[],
        }> = {};

        const markSize = 0.2; // Tweak this to set marker size

        // Функция, которая добавлет объект на карту
        const loadModelAndPlayAnimation = (model: string, index = 0, scale = 1, animationIndex?: number): Promise<{
            model: THREE.Group,
            animation?: THREE.AnimationMixer,
            unSphere?: THREE.Mesh,
        }> => new Promise(
            (resolve) => {
                loader.load(
                    model,
                    gltf => {
                        const scene = overlay.getScene();
                        const model = gltf.scene;

                        model.scale.set(scale, scale, scale);
                        model.rotation.set(Math.PI / 2, 0, Math.PI, 'ZXY');
                        scene.add(model);

                        // Add uncertainity

                        const uncertainitySphere = getUncertainity(1, 16, 0.6, COLORS[index]);
                        scene.add(uncertainitySphere);

                        let mixer: THREE.AnimationMixer | undefined;

                        if (typeof animationIndex === 'number') {
                            const skeleton = new THREE.SkeletonHelper(model);
                            skeleton.visible = false;
                            scene.add(skeleton);

                            const animations = gltf.animations;
                            mixer = new THREE.AnimationMixer(model);

                            const anim = animations[animationIndex];
                            const action = anim && mixer.clipAction(anim);
                            action?.play();
                        }

                        resolve({ model, animation: mixer, unSphere: uncertainitySphere });
                    }
                );
            }
        )

        overlay.onAdd = () => {
            const scene = overlay.getScene();
            clock = new THREE.Clock();
            loader = new GLTFLoader();

            const objectAndFirstKeyframes = keyframes.reduce<Record<string, Keyframe>>((acc, keyframe) => {
                if (acc[keyframe.id]) {
                    return acc;
                }
                acc[keyframe.id] = keyframe;
                return acc;
            }, {});

            const fontl = new FontLoader();

            Object.entries(objectAndFirstKeyframes).forEach(async ([_id, keyframe], i) => {
                const model = ACTIVITY_TO_MODEL[keyframe.activity];
                const animation = ACTIVITY_TO_ANIMATION_INDEX[keyframe.activity];

                // const points = keyframes.filter(({ id }) => id === _id).map(({ lat, lng }) => overlay.latLngAltToVector3({ lat, lng }));
                // const curve = new THREE.CatmullRomCurve3(points, true, 'catmullrom', 0.2);
                // curve.updateArcLengths();

                // console.log('added', _id, model, animation);

                const pos = overlay.latLngAltToVector3({ lat: keyframe.lat, lng: keyframe.lng, altitude: keyframe.alt })

                const object = await loadModelAndPlayAnimation(model.name, i, model.scale, animation);
                const group = new THREE.Group();

                fontl.load( 'https://threejs.org/examples/fonts/helvetiker_regular.typeface.json', function ( _font ) {
                    font = _font;
                    const color = COLORS[i];
                    const matLite = new THREE.MeshBasicMaterial( {
						color: color,
						side: THREE.DoubleSide
					} );

					let message = '';

                    if (_id !== 'null') {
                        message = _id;
                    }

                    if (keyframe.floor > 0) {
                        const newLine = _id !== 'null' ? '\n' : '';
                        message += newLine + keyframe.floor + ' floor' 
                    }

					// const shapes = font.generateShapes( message, 3 );

					// const geometry = new THREE.ShapeGeometry( shapes );
                    // geometry

					// geometry.computeBoundingBox();

                    // geometry.rotateZ(Math.PI / 2);
                    // geometry.rotateY(Math.PI / 2);

                    // const xMid = - 0.5 * ( geometry.boundingBox.max.x - geometry.boundingBox.min.x );
                    // geometry.translate(xMid, 0, 10);

					// make shape ( N.B. edge view not visible )

                    
                    group.position.set(pos.x, pos.y, pos.z);
                    group.rotateX(Math.PI / 2);
                    // group.rotateY(Math.PI / 2);
                    scene.add(group);

                    const shapes = font.generateShapes( message, 3 );
                    const geometry = new THREE.ShapeGeometry( shapes );
                    geometry.computeBoundingBox();
                    geometry.translate(0, 20, 0);
                    const text = new THREE.Mesh( geometry, matLite );

                    group.add(text);
					// text.position.z = - 150;

                    // object.model.attach(group);
                })

                // object.model.attach(sprite);

                // const points: Vector3[] = [];
                // const points = keyframes.map(({ lat, lng, alt: altitude }) => overlay.latLngAltToVector3({ lat, lng, altitude }));

                // const bgeometry = new THREE.BufferGeometry().setFromPoints( points );

                // if (bgeometry.attributes.position) {
                //     bgeometry.attributes.position.needsUpdate = true
                // }

                // const geometry = new LineGeometry();

                // geometry.setFromPoints(points);

                // const material = new MeshLineMaterial( { color: 0x00ffff, lineWidth: 5, 
                //                     opacity: 1, transparent: false } );
                // const material = new MeshLineMaterial({lineWidth: 2,
                //     color: 0xff0000,
                //     useMap: false,
                //     opacity: 1,
                //     resolution: new THREE.Vector2(window.innerWidth, window.innerHeight),
                //     sizeAttenuation: false,
                // })
                // const meshLine = new MeshLine();
                // meshLine.setGeometry(geometry);

                // const material = new LineMaterial( {

				// 	color: 0x00aaff,
				// 	linewidth: 5, // in world units with size attenuation, pixels otherwise
				// 	dashed: false,
				// } );
                // const line = new Line2( geometry, material );

                // const material = new THREE.LineBasicMaterial({ color: 0xff0000 });
                // const line = new THREE.Line(bgeometry, material);
            
                // overlay.getScene().add(line);

                objects[_id] = {
                    ...object,
                    // line,
                    front: model.front,
                    scale: model.scale,
                    group,
                    // points,
                };
            });
        };

        overlay.update = () => {
            // const scene = overlay.getScene();
            const delta = clock.getDelta();
            const currentTime = (clock.elapsedTime) * 1000 * 10;

            overlay.requestRedraw();

            Object.values(objects).forEach(({ animation }) => {
                animation?.update(delta);
            });
            const ids = Object.keys(objects);
            const acc: Record<string, Keyframe & {
                next?: Keyframe,
            }> = {}
            for (const id of ids) {

                const neededFrames = keyframes.filter(({ id: _id }) => _id === id);
                for (const _frame of neededFrames) {
                    const frame = {
                        ..._frame
                    }
                    const current = acc[id];
                    if (frame.timestamp > currentTime && current) {
                        const ratio = (currentTime - current.timestamp) / (frame.timestamp - current.timestamp);
                        const latDiff = frame.lat - current.lat;
                        const lngDiff = frame.lng - current.lng;
                        const altDiff = frame.alt - current.alt;

                        frame.lat = current.lat + latDiff * ratio;
                        frame.lng = current.lng + lngDiff * ratio;
                        frame.alt = current.alt + altDiff * ratio;
                        acc[id] = {
                            ...frame,
                            next: {
                                ..._frame
                            }
                        };

                        break;
                    }
                    acc[id] = frame;
                }
            }


            Object.entries(acc).forEach(([id, keyframe], i) => {
                const scene = overlay.getScene();
                const model = objects[id]?.model;
                const front = objects[id]?.front;
                const sphere = objects[id]?.unSphere;
                const scale = objects[id]?.scale || 1;
                const group = objects[id]?.group;
                // const line = objects[id]?.line;
                // const points = objects[id]?.points || [];
                if (!model || !front || !group) {
                    return;
                }
                const pos = overlay.latLngAltToVector3({
                    lat: keyframe.lat,
                    lng: keyframe.lng,
                    altitude: keyframe.alt,
                });

                model.position.set(pos.x, pos.y, keyframe.alt);
                sphere?.position.set(pos.x, pos.y, keyframe.alt + 1.5);
                sphere?.scale.set(keyframe.horAcc, keyframe.verAcc, keyframe.horAcc);

                if (keyframe.next) {
                    const nextPoint = overlay.latLngAltToVector3({
                        lat: keyframe.next.lat,
                        lng: keyframe.next.lng,
                        altitude: keyframe.next.alt,
                    });
                    /** next point sphere */
                    // next.position.set(nextPoint.x, nextPoint.y, nextPoint.z);
                    /** */
                    // nextPoint.setZ(keyframe.alt);
                    //model.lookAt(nextPoint);
                    const direction = new THREE.Vector3();
                    direction.subVectors(pos, nextPoint).normalize();

                    const rotationMatrix = new THREE.Matrix4();
                    const targetQuaternion = new THREE.Quaternion();
                    rotationMatrix.lookAt(nextPoint, pos, front);
                    targetQuaternion.setFromRotationMatrix(rotationMatrix);

                    model.quaternion.rotateTowards(targetQuaternion, Math.PI);

                    // curve.geometry.setPositions([...points, pos])
                    // curve.points.push(pos);
                    // console.log(curve.points);
                    // curve.updateArcLengths();
                    // points.push(pos);
                    // points.push(pos);
                    // line.geometry.setFromPoints(points);
                    // line.geometry.computeBoundingSphere();
                    //console.log(line.geometry)
                    // overlay.getScene().add(line);

                    if (font) {
                        group.clear();

                        let message = '';

                        if (id !== 'null') {
                            message = id;
                        }

                        if (keyframe.floor > 0) {
                            const newLine = id !== 'null' ? '\n' : '';
                            message += newLine + keyframe.floor + ' floor' 
                        }

                        const color = COLORS[i];
                        const matLite = new THREE.MeshBasicMaterial( {
                            color: color,
                            side: THREE.DoubleSide
                        } );

                        const shapes = font.generateShapes( message, 3 );
                        const geometry = new THREE.ShapeGeometry( shapes );
                        geometry.translate(0, 20, 0);
                        geometry.computeBoundingBox();
                        const text = new THREE.Mesh( geometry, matLite );

                        group.add(text);

                        group.position.set(pos.x, pos.y, pos.z);
                    }

                    const markGeom = new THREE.BoxGeometry(markSize, markSize, markSize, 1, 1, 1);
                    const markMat = new THREE.MeshBasicMaterial({ color: COLORS[i] });
                    const marker = new THREE.Mesh(markGeom, markMat);
                    marker.position.copy(pos);
                    marker.scale.set(scale, scale, scale);
                    scene.add(marker);

                    if (keyframe.activity == "cycling") {
                        model.rotation.y = model.rotation.y + Math.PI;
                    }
                }
            });
        }

        overlay.setMap(map);
    }, [center, keyframes]);

    React.useLayoutEffect(() => {
        if (ref.current && !map) {
            const newMap = new window.google.maps.Map(ref.current, {
                tilt: 0,
                heading: 0,
                center,
                zoom,
                mapId,
                disableDefaultUI: true,
                streetViewControl: false,
            });
            setMap(newMap);
            initWebGLOverlay(newMap);
        }
    }, [map, center, zoom, mapId, initWebGLOverlay]);


    return (
        <>
            <div
                style={{
                    minHeight: "100vh",
                }}
                ref={ref}
            >
            </div>
        </>
    )
};


export default Map;
