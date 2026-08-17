// Phase 4 Slice A — closed content component barrel. Screen-experience
// modules under `apps/docs/src/components/screen-experiences/` import from
// this module rather than reaching into individual files, so the closed set
// stays discoverable in one place. This is a plain TypeScript re-export, not
// an MDX component registry: authored `.mdx` content never references these
// names directly (see `docs/decisions/docs-catalog-and-safe-components.md`,
// approach 2 rejected — no exact-name safe MDX components). Consumers are
// TypeScript screen-experience files composing literal, typed props.

export { Callout, type CalloutProps, type CalloutVariant } from "./callout.tsx";
export { CommandBlock, type CommandBlockProps } from "./command-block.tsx";
export { Procedure, type ProcedureProps, Step, type StepProps } from "./procedure.tsx";
export { ResponsiveDataRegion, type ResponsiveDataRegionProps, type DataColumn, type DataRow } from "./responsive-data-region.tsx";
export { Topology, type TopologyProps, type TopologyNode, type TopologyNodeShape, type TopologyEdge } from "./topology.tsx";
export { OperationMatrix, type OperationMatrixProps, type OperationRow, type OperationKind } from "./operation-matrix.tsx";
