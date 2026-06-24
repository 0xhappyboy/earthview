import Feature from "ol/Feature";
import LineString from "ol/geom/LineString";
import Point from "ol/geom/Point";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import Style from "ol/style/Style";
import Stroke from "ol/style/Stroke";
import Text from "ol/style/Text";
import Fill from "ol/style/Fill";
import { fromLonLat } from "ol/proj";
import { getLength } from "ol/sphere";
import { BaseLayer } from "../BaseLayer";
import { LayerTypeEnum, PolylineData, MeasurementPoint } from "../../types";
import { arrayToRgba } from "../../utils";

export class PolylineLayer extends BaseLayer {
    private features: Map<string, Feature> = new Map();
    private labelFeatures: Map<string, Feature> = new Map();
    private labelTexts: Map<string, string> = new Map(); 
    private defaultColor: number[];
    private defaultWidth: number;
    private defaultShowMeasurement: boolean;

    constructor(
        id: string,
        name: string,
        options?: {
            defaultColor?: number[];
            defaultWidth?: number;
            defaultShowMeasurement?: boolean;
            visible?: boolean;
            opacity?: number;
            zIndex?: number;
        }
    ) {
        super(id, name, LayerTypeEnum.POLYLINE, {
            ...options,
            zIndex: options?.zIndex ?? 10,
        });
        this.defaultColor = options?.defaultColor || [0, 0, 255, 1];
        this.defaultWidth = options?.defaultWidth || 3;
        this.defaultShowMeasurement = options?.defaultShowMeasurement ?? true;
        this.source = new VectorSource();
        this.layer = new VectorLayer({
            source: this.source,
            properties: { id, name, type: LayerTypeEnum.POLYLINE },
            visible: this.visible,
            opacity: this.opacity,
            zIndex: this.zIndex,
        });
    }

    public createLayer(map: any): VectorLayer<VectorSource> {
        map.addLayer(this.layer);
        return this.layer;
    }

    public addPolyline(data: PolylineData): void {
        const points = data.points.map(([lng, lat]) => fromLonLat([lng, lat]));
        const line = new LineString(points);
        const feature = new Feature({
            geometry: line,
            id: data.id,
            title: data.title,
        });
        feature.setStyle(
            new Style({
                stroke: new Stroke({
                    color: arrayToRgba(data.color || this.defaultColor),
                    width: data.width || this.defaultWidth,
                }),
            })
        );
        this.source?.addFeature(feature);
        this.features.set(data.id, feature);
        const showMeasurement = data.showMeasurement !== undefined
            ? data.showMeasurement
            : this.defaultShowMeasurement;
        if (showMeasurement) {
            this.addDistanceLabel(data);
        }
    }

    private addDistanceLabel(data: PolylineData): void {
        const points: MeasurementPoint[] = data.points.map(([lng, lat]) => ({
            longitude: lng,
            latitude: lat,
        }));
        let totalDistance = 0;
        for (let i = 0; i < points.length - 1; i++) {
            totalDistance += this.calculateDistance(points[i], points[i + 1]);
        }
        const midIndex = Math.floor(data.points.length / 2);
        const midPoint = data.points[midIndex] || data.points[0];
        const [midX, midY] = fromLonLat(midPoint);
        const distanceText = totalDistance >= 1000
            ? `${(totalDistance / 1000).toFixed(2)} km`
            : `${totalDistance.toFixed(0)} m`;
        const labelFeature = new Feature({
            geometry: new Point([midX, midY]),
            polylineId: data.id,
            type: "distance_label",
        });
        labelFeature.setStyle(
            new Style({
                text: new Text({
                    text: distanceText,
                    font: "14px sans-serif",
                    fill: new Fill({ color: "#ffffff" }),
                    stroke: new Stroke({ color: "#000000", width: 3 }),
                    textAlign: "center",
                    textBaseline: "middle",
                }),
            })
        );
        this.source?.addFeature(labelFeature);
        this.labelFeatures.set(data.id, labelFeature);
        this.labelTexts.set(data.id, distanceText);
    }

    private calculateDistance(p1: MeasurementPoint, p2: MeasurementPoint): number {
        const line = new LineString([
            [p1.longitude, p1.latitude],
            [p2.longitude, p2.latitude],
        ]);
        return getLength(line, { projection: "EPSG:4326" });
    }

    public updatePolylineMeasurementVisibility(id: string, show: boolean): void {
        const labelFeature = this.labelFeatures.get(id);
        const labelText = this.labelTexts.get(id);
        if (labelFeature && labelText) {
            if (show) {
                labelFeature.setStyle(
                    new Style({
                        text: new Text({
                            text: labelText,
                            font: "14px sans-serif",
                            fill: new Fill({ color: "#ffffff" }),
                            stroke: new Stroke({ color: "#000000", width: 3 }),
                            textAlign: "center",
                            textBaseline: "middle",
                        }),
                    })
                );
            } else {
                labelFeature.setStyle(new Style({}));
            }
        }
    }

    public removePolyline(id: string): void {
        const feature = this.features.get(id);
        if (feature) {
            this.source?.removeFeature(feature);
            this.features.delete(id);
        }
        const labelFeature = this.labelFeatures.get(id);
        if (labelFeature) {
            this.source?.removeFeature(labelFeature);
            this.labelFeatures.delete(id);
            this.labelTexts.delete(id);
        }
    }

    public updateData(data: { polylines?: PolylineData[] }): void {
        if (data.polylines) {
            this.clear();
            data.polylines.forEach((polyline) => this.addPolyline(polyline));
        }
    }

    public getAllPolylines(): PolylineData[] {
        const result: PolylineData[] = [];
        this.features.forEach((feature, id) => {
            result.push(feature.getProperties() as PolylineData);
        });
        return result;
    }

    public getPolyline(id: string): PolylineData | undefined {
        const feature = this.features.get(id);
        if (feature) {
            return feature.getProperties() as PolylineData;
        }
        return undefined;
    }

    public clear(): void {
        super.clear();
        this.features.clear();
        this.labelFeatures.clear();
        this.labelTexts.clear();
    }
}