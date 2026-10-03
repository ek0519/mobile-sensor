import type { Capabilities, MotionData, OrientationData, LocationData, PointerData } from '../types';
export const SENSOR_RECORDING_SCHEMA_VERSION = 1;
export type RecordedSensorType = 'motion' | 'orientation' | 'location' | 'pointer';
export interface RecordingDeviceInfo { userAgent: string; platform: string | null; screen: { width: number; height: number; devicePixelRatio: number }; language: string | null }
export interface RecordingSessionMetadata { schemaVersion: 1; id: string; label: string; startedAt: number; device: RecordingDeviceInfo; capabilities: Capabilities; includeLocation: boolean }
type RecordOf<S, D> = { sensor: S; seq: number; t: number; timestamp: number; data: D };
export type MotionSensorRecord = RecordOf<'motion', MotionData>;
export type OrientationSensorRecord = RecordOf<'orientation', OrientationData>;
export type LocationSensorRecord = RecordOf<'location', LocationData>;
export type PointerSensorRecord = RecordOf<'pointer', PointerData>;
export type SensorRecord = MotionSensorRecord | OrientationSensorRecord | LocationSensorRecord | PointerSensorRecord;
export interface SensorRecording { startedAt: number; endedAt: number; records: SensorRecord[] }
export interface SensorRecorderOptions { includeLocation?: boolean; maxRecords?: number }
export interface SensorRecorder { start(): void; stop(): SensorRecording; clear(): void; getRecords(): readonly SensorRecord[]; isRecording(): boolean }
