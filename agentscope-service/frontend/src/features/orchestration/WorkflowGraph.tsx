/*
 * Copyright 2024-2026 the original author or authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { useId, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { graphLayout } from "./workflowModel";
import { teamTone, stateLabel } from "@/features/teams/teamActivity";
import { nodeTypeLabels } from "./nodeTypeLabels";

/** 缩放范围与步长（PRD 5.9 / C11）。 */
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 1.5;
const ZOOM_STEP = 0.15;

export type GraphOffsets = Record<string, { x: number; y: number }>;

/**
 * 把拖拽偏移按「工作流 id」落在 sessionStorage。
 *
 * D 阶段收口：此前偏移只存在组件局部 state，切 tab / 刷新即回落到自动布局，
 * 与用户「摆好的位置应该记住」的预期不符。这里做工作流级别的持久化，
 * 仍以自动布局为真相——「自动布局」按钮会连同存储一起清空。
 */
function loadOffsets(storageKey: string): GraphOffsets {
  if (typeof window === 'undefined' || !storageKey) return {};
  try {
    const raw = window.sessionStorage.getItem(storageKey);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const result: GraphOffsets = {};
    for (const [id, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (
        value &&
        typeof value === 'object' &&
        typeof (value as { x?: unknown }).x === 'number' &&
        typeof (value as { y?: unknown }).y === 'number'
      ) {
        result[id] = { x: (value as { x: number }).x, y: (value as { y: number }).y };
      }
    }
    return result;
  } catch {
    return {};
  }
}

function saveOffsets(storageKey: string, offsets: GraphOffsets): void {
  if (typeof window === 'undefined' || !storageKey) return;
  try {
    if (Object.keys(offsets).length === 0) window.sessionStorage.removeItem(storageKey);
    else window.sessionStorage.setItem(storageKey, JSON.stringify(offsets));
  } catch {
    // 存储不可用（隐私模式 / 配额）时静默降级为不持久化，不影响画布交互。
  }
}

interface GraphPoint {
  id: string;
  x: number;
  y: number;
}

export function WorkflowGraph({
  nodes,
  edges,
  selected,
  onSelect,
  persistKey,
}: {
  nodes: { id: string; label: string; type: string; state?: string }[];
  edges: { from: string; to: string; label?: string }[];
  selected?: string;
  onSelect: (id: string) => void;
  /** 提供后，拖拽偏移按工作流粒度持久化（sessionStorage）。 */
  persistKey?: string;
}) {
  const marker = useId().replace(/:/g, "");
  const points = graphLayout(
    nodes.map((n) => n.id),
    edges,
  );
  const storageKey = persistKey ? `workflow-graph-offsets:${persistKey}` : '';
  // 拖拽偏移（C11）：局部覆盖自动布局坐标，「自动布局」按钮一键还原。
  const [offsets, setOffsets] = useState<GraphOffsets>(() => loadOffsets(storageKey));

  // 切换工作流时重新读取对应存储，避免把上一条工作流的坐标带过来。
  // 用「上一 storageKey」比较而非 effect 依赖偏移，防止把本地的拖拽结果覆盖回去。
  const loadedKeyRef = useRef(storageKey);
  if (loadedKeyRef.current !== storageKey) {
    loadedKeyRef.current = storageKey;
    setOffsets(loadOffsets(storageKey));
  }

  const updateOffsets = (next: GraphOffsets) => {
    setOffsets(next);
    saveOffsets(storageKey, next);
  };
  const [zoom, setZoom] = useState(1);
  const dragRef = useRef<{ id: string; startX: number; startY: number; base: { x: number; y: number } } | null>(null);
  const auto = new Map(points.map((p) => [p.id, p]));
  const positionOf = (p: GraphPoint) => offsets[p.id] ?? { x: p.x, y: p.y };
  const laid = points.map((p) => ({ id: p.id, ...positionOf(p) }));
  const positions = new Map(laid.map((p) => [p.id, p]));
  const width = Math.max(480, ...laid.map((p) => p.x + 244));
  const height = Math.max(140, ...laid.map((p) => p.y + 112));

  const onPointerMove = (event: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const next = {
      x: Math.max(0, drag.base.x + (event.clientX - drag.startX) / zoom),
      y: Math.max(0, drag.base.y + (event.clientY - drag.startY) / zoom),
    };
    setOffsets((prev) => {
      const merged = { ...prev, [drag.id]: next };
      saveOffsets(storageKey, merged);
      return merged;
    });
  };
  const endDrag = () => {
    dragRef.current = null;
  };

  return (
    <div className="min-w-0 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5" role="group" aria-label="画布缩放">
          <Button
            size="sm"
            variant="outline"
            aria-label="缩小"
            disabled={zoom <= ZOOM_MIN + 1e-9}
            onClick={() => setZoom((z) => Math.max(ZOOM_MIN, +(z - ZOOM_STEP).toFixed(2)))}
          >
            −
          </Button>
          <span className="min-w-12 text-center text-xs tabular-nums text-text-3">
            {Math.round(zoom * 100)}%
          </span>
          <Button
            size="sm"
            variant="outline"
            aria-label="放大"
            disabled={zoom >= ZOOM_MAX - 1e-9}
            onClick={() => setZoom((z) => Math.min(ZOOM_MAX, +(z + ZOOM_STEP).toFixed(2)))}
          >
            +
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setZoom(1)}
            disabled={zoom === 1}
          >
            重置缩放
          </Button>
        </div>
        <Button
          size="sm"
          variant="ghost"
          disabled={Object.keys(offsets).length === 0}
          onClick={() => updateOffsets({})}
          title="清除手动拖拽，恢复自动布局坐标"
        >
          自动布局
        </Button>
      </div>
      <div
        role="region"
        aria-label="工作流画布"
        tabIndex={0}
        className="min-w-0 max-w-full max-h-[600px] overflow-auto rounded-xl border border-border bg-surface-2"
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
      >
        <div className="relative" style={{ width, height, transform: `scale(${zoom})`, transformOrigin: "top left" }}>
          <svg
            width={width}
            height={height}
            className="pointer-events-none absolute inset-0"
            aria-hidden="true"
          >
            <defs>
              <marker
                id={marker}
                markerWidth="7"
                markerHeight="7"
                refX="6"
                refY="3.5"
                orient="auto"
              >
                <path d="M0,0 L7,3.5 L0,7" fill="currentColor" className="text-text-3" />
              </marker>
            </defs>
            {edges.map((edge, i) => {
              const a = positions.get(edge.from),
                b = positions.get(edge.to);
              if (!a || !b) return null;
              return (
                <g key={i} className="text-text-3">
                  <path
                    d={`M${a.x + 208},${a.y + 42} C${a.x + 235},${a.y + 42} ${b.x - 25},${b.y + 42} ${b.x - 3},${b.y + 42}`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeDasharray={edge.label ? "4 3" : undefined}
                    markerEnd={`url(#${marker})`}
                  />
                  {edge.label && (
                    <text
                      x={(a.x + 208 + b.x) / 2}
                      y={(a.y + b.y) / 2 + 31}
                      textAnchor="middle"
                      fontSize="9"
                      fill="currentColor"
                      className="text-text-3"
                    >
                      {edge.label}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
          {nodes.map((node) => {
            const raw = auto.get(node.id)!;
            const p = positionOf(raw);
            return (
              <button
                key={node.id}
                aria-pressed={selected === node.id}
                onClick={() => onSelect(node.id)}
                onPointerDown={(event) => {
                  dragRef.current = {
                    id: node.id,
                    startX: event.clientX,
                    startY: event.clientY,
                    base: p,
                  };
                }}
                onPointerUp={endDrag}
                style={{ left: p.x, top: p.y, width: 208, height: 88 }}
                className={`absolute cursor-grab touch-none rounded-lg border bg-surface p-3 text-left shadow-sm active:cursor-grabbing ${selected === node.id ? "border-primary ring-1 ring-primary" : "border-border hover:border-border-strong"}`}
              >
                <span className="flex items-center justify-between gap-1 text-xs text-muted-foreground">
                  <span>{nodeTypeLabels[node.type] ?? node.type}</span>
                  {node.state && (
                    <Badge tone={teamTone(node.state)}>
                      {stateLabel(node.state)}
                    </Badge>
                  )}
                </span>
                <span className="mt-2 block truncate text-sm font-medium">
                  {node.label}
                </span>
              </button>
            );
          })}
        </div>
        {!nodes.length && (
          <p className="p-4 text-sm text-muted-foreground">
            添加一个节点，开始设计这个工作流。
          </p>
        )}
      </div>
    </div>
  );
}
