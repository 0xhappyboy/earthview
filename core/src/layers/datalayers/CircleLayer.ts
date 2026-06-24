import Feature from "ol/Feature";
import Circle from "ol/geom/Circle";
import Point from "ol/geom/Point";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import Style from "ol/style/Style";
import Fill from "ol/style/Fill";
import Stroke from "ol/style/Stroke";
import Text from "ol/style/Text";
import { fromLonLat } from "ol/proj";
import { getArea } from "ol/sphere";
import { BaseLayer } from "../BaseLayer";
import { LayerTypeEnum, CircleData } from "../../types";
import { arrayToRgba } from "../../utils";

export class CircleLayer extends BaseLayer {
    private features: Map<string, Feature> = new Map();
    private labelFeatures: Map<string, Feature> = new Map();
    private labelTexts: Map<string, string> = new Map();
    private defaultFillColor: number[];
    private defaultOutlineColor: number[];
    private defaultOutlineWidth: number;
    private defaultShowMeasurement: boolean;

    constructor(
        id: string,
        name: string,
        options?: {
            defaultFillColor?: number[];
            defaultOutlineColor?: number[];
            defaultOutlineWidth?: number;
            defaultShowMeasurement?: boolean;
            visible?: boolean;
            opacity?: number;
            zIndex?: number;
        }
    ) {
        super(id, name, LayerTypeEnum.CIRCLE, {
            ...options,
            zIndex: options?.zIndex ?? 15,
        });
        this.defaultFillColor = options?.defaultFillColor || [0, 255, 0, 0.3];
        this.defaultOutlineColor = options?.defaultOutlineColor || [0, 255, 0, 1];
        this.defaultOutlineWidth = options?.defaultOutlineWidth || 2;
        this.defaultShowMeasurement = options?.defaultShowMeasurement ?? true;
        this.source = new VectorSource();
        this.layer = new VectorLayer({
            source: this.source,
            properties: { id, name, type: LayerTypeEnum.CIRCLE },
            visible: this.visible,
            opacity: this.opacity,
            zIndex: this.zIndex,
        });
    }

    public createLayer(map: any): VectorLayer<VectorSource> {
        map.addLayer(this.layer);
        return this.layer;
    }

    public addCircle(data: CircleData): void {
        const center = fromLonLat(data.center);
        const circle = new Circle(center, data.radius);
        const feature = new Feature({
            geometry: circle,
            id: data.id,
            title: data.title,
        });
        feature.setStyle(
            new Style({
                fill: new Fill({ color: arrayToRgba(data.fillColor || this.defaultFillColor) }),
                stroke: new Stroke({
                    color: arrayToRgba(data.outlineColor || this.defaultOutlineColor),
                    width: data.outlineWidth || this.defaultOutlineWidth,
                }),
            })
        );
        this.source?.addFeature(feature);
        this.features.set(data.id, feature);
        const showMeasurement = data.showMeasurement !== undefined
            ? data.showMeasurement
            : this.defaultShowMeasurement;
        if (showMeasurement) {
            this.addCircleAreaLabel(data);
        }
    }

    private addCircleAreaLabel(data: CircleData): void {
        const [centerX, centerY] = fromLonLat(data.center);
        const area = Math.PI * data.radius * data.radius;
        const areaText = area >= 1000000
            ? `${(area / 1000000).toFixed(2)} km²`
            : `${area.toFixed(0)} m²`;
        const labelFeature = new Feature({
            geometry: new Point([centerX, centerY]),
            circleId: data.id,
            type: "area_label",
        });
        labelFeature.setStyle(
            new Style({
                text: new Text({
                    text: areaText,
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
        this.labelTexts.set(data.id, areaText);
    }

    public updateCircleMeasurementVisibility(id: string, show: boolean): void {
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

    public removeCircle(id: string): void {
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

    public updateData(data: { circles?: CircleData[] }): void {
        if (data.circles) {
            this.clear();
            data.circles.forEach((circle) => this.addCircle(circle));
        }
    }

    public getAllCircles(): CircleData[] {
        const result: CircleData[] = [];
        this.features.forEach((feature, id) => {
            result.push(feature.getProperties() as CircleData);
        });
        return result;
    }

    public getCircle(id: string): CircleData | undefined {
        const feature = this.features.get(id);
        if (feature) {
            return feature.getProperties() as CircleData;
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