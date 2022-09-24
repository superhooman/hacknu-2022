import React from "react";
import * as THREE from 'three';
import ThreejsOverlayView from '@ubilabs/threejs-overlay-view';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Keyframe } from "../../typings";
import next from "next";

interface MapProps {
    zoom: number;
    mapId?: string;
    keyframes: Keyframe[];
}

const ACTIVITY_TO_MODEL: Record<Keyframe['activity'], string> = {
    'walking': 'person.glb',
    'running': 'person.glb',
    'cycling': 'pin.gltf',
    'driving': 'pin.gltf',
    'UNKNOWN': 'person.glb',
}

const ACTIVITY_TO_ANIMATION_INDEX: Record<Keyframe['activity'], number | undefined> = {
    'walking': 3,
    'running': 4,
    'UNKNOWN': 0,
    'cycling': undefined,
    'driving': undefined,
}

const lonLatToVector3 = (lng: number, lat: number) => {
    const out = new THREE.Vector3();
    lat = Math.PI / 2 - lat;
    out.set(
        Math.sin(lat) * Math.sin(lng),
        Math.cos(lat),
        Math.sin(lat) * Math.cos(lng)
    );
    return out;
}

const Map: React.FC<MapProps> = ({ zoom, mapId = '949ef5dcea77455', keyframes = [] }) => {
    const ref = React.useRef<HTMLDivElement>(null);
    const [map, setMap] = React.useState<google.maps.Map>();

    const center = React.useMemo(() => {
        const all = keyframes.reduce((acc, keyframe) => {
            acc.lat += keyframe.lat;
            acc.lng += keyframe.lng;
            return acc;
        }, { lat: 0, lng: 0 });
        all.lat = all.lat / keyframes.length
        all.lng = all.lng / keyframes.length
        return all;
    }, [keyframes]);

    // Здесь запускаем 3d слой
    const initWebGLOverlay = React.useCallback((map: google.maps.Map) => {
        const overlay = new ThreejsOverlayView(center);
        let loader: GLTFLoader;
        let clock: THREE.Clock;
        const objects: Record<string, {
            model: THREE.Group,
            animation?: THREE.AnimationMixer,
        }> = {};

        // Функция, которая добавлет объект на карту
        const loadModelAndPlayAnimation = (model: string, animationIndex?: number): Promise<{
            model: THREE.Group,
            animation?: THREE.AnimationMixer,
        }> => new Promise(
            (resolve) => {
                loader.load(
                    model,
                    gltf => {
                        const scene = overlay.getScene();
                        const model = gltf.scene;

                        model.scale.set(5, 5, 5);
        
                        scene.add(model);

                        let mixer: THREE.AnimationMixer | undefined;
        
                        if (typeof animationIndex === 'number') {
                            const skeleton = new THREE.SkeletonHelper(model);
                            skeleton.visible = false;
                            scene.add(skeleton);
            
                            const animations = gltf.animations;
                            mixer = new THREE.AnimationMixer( model );
            
                            const anim = animations[animationIndex];
                            const action = anim && mixer.clipAction( anim );
                            action?.play();
                        }

                        resolve({ model, animation: mixer });
                    }
                );
            }
        )

        overlay.onAdd = () => {
            clock = new THREE.Clock();
            loader = new GLTFLoader();

            const objectAndFirstKeyframes = keyframes.reduce<Record<string, Keyframe>>((acc, keyframe) => {
                if (acc[keyframe.id]) {
                    return acc;
                }
                acc[keyframe.id] = keyframe;
                return acc;
            }, {});

            Object.entries(objectAndFirstKeyframes).forEach(async ([_id, keyframe]) => {
                const model = ACTIVITY_TO_MODEL[keyframe.activity];
                const animation = ACTIVITY_TO_ANIMATION_INDEX[keyframe.activity];

                console.log('added', _id, model, animation);

                const object = await loadModelAndPlayAnimation(model, animation);
                objects[_id] = object;
            });
        };

        overlay.update = () => {
            const delta = clock.getDelta();
            const currentTime = clock.elapsedTime * 10000;

            overlay.requestRedraw();

            Object.values(objects).forEach(({ animation }) => {
                animation?.update(delta);
            });

            const objectsAndCurrentKeyframes = keyframes.reduce<Record<string, Keyframe & {
                next?: Keyframe
            }>>((acc, keyframe) => {
                if (keyframe.timestamp < currentTime) {
                    return acc;
                }
                const current = acc[keyframe.id];
                if (current) {
                    const ratio = currentTime / keyframe.timestamp;
                    const newKeyframe = {
                        ...keyframe
                    };
                    const latDiff = newKeyframe.lat - current.lat;
                    const lngDiff = newKeyframe.lng - current.lng;
                    const altDiff = newKeyframe.alt - current.alt;
                    newKeyframe.lat = current.lat + latDiff * ratio;
                    newKeyframe.lng = current.lng + lngDiff * ratio;
                    newKeyframe.alt = current.alt + altDiff * ratio;

                    acc[keyframe.id] = {
                        ...newKeyframe,
                        next: keyframe,
                    };

                    return acc;
                }
                acc[keyframe.id] = keyframe;
                return acc;
            }, {});

            Object.entries(objectsAndCurrentKeyframes).forEach(([id, keyframe]) => {
                const model = objects[id]?.model;
                if (!model) {
                    return;
                }
                overlay.latLngAltToVector3({
                    lat: keyframe.lat,
                    lng: keyframe.lng,
                }, model.position);
                model.position.setZ(keyframe.alt);

                if (keyframe.next && keyframe.activity !== 'UNKNOWN') {
                    const nextPoint = overlay.latLngAltToVector3(keyframe.next);
                    nextPoint.setZ(keyframe.alt);
                    model.lookAt(nextPoint);
                    model.rotation.z = Math.PI;
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
