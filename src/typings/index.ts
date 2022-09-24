export interface Keyframe {
    lat: number;
    lng: number;
    alt: number;
    id: string | "null";
    timestamp: number;
    floor: number | "null";
    horAcc: number;
    verAcc: number;
    locAccConfidence: number;
    activity: "UNKNOWN" | "running" | "cycling" | "driving" | "walking";
}