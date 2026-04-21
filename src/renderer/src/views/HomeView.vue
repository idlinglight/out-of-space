<script setup lang="ts">
import { ref, watch } from 'vue'
import { useScanStore } from '@/stores/scan'
import TreemapView from '@/visualisation/treemap/TreemapView.vue'
import ContextMenu from '@/components/ContextMenu.vue'
import BreadcrumbRootbar from '@/components/BreadcrumbRootbar.vue'
import BreadcrumbToolbar from '@/components/BreadcrumbToolbar.vue'
import { useKeyboardNavigation } from '@/composables/useKeyboardNavigation'
import type { FileNode } from '@shared/types'
import {formatBytes} from "@shared/format";

const scanStore = useScanStore()
const viewRoot = ref<FileNode | null>(null)

useKeyboardNavigation({
  viewRoot,
  onDrillDown: drillIntoSelection,
  onDrillUp: goUp
})

watch(
  () => scanStore.rootNode,
  (node) => {
    viewRoot.value = node
  }
)

function onDrillDown(node: FileNode): void {
  if (node.type === 'directory') {
    viewRoot.value = node
  }
}

function drillIntoSelection(): void {
  if (scanStore.selectedNode?.type === 'directory') {
    viewRoot.value = scanStore.selectedNode
  }
}

function goUp(): void {
  if (!viewRoot.value || !scanStore.rootNode) return
  const parent = scanStore.parentOf(viewRoot.value)
  viewRoot.value = parent ?? scanStore.rootNode
}

function selectParent(): void {
  if (!scanStore.selectedNode || !scanStore.rootNode) return
  const parent = scanStore.parentOf(scanStore.selectedNode)
  if (parent) scanStore.selectNode(parent)
}

function rescan(): void {
  if (!scanStore.rootNode || scanStore.isScanning) return
  scanStore.scan(scanStore.rootNode.path)
}

function scanOther(): void {
  scanStore.selectAndScan()
}

function navigateTo(node: FileNode): void {
  viewRoot.value = node
}

const hoveredPath = ref<string | null>(null)
const statusHint = ref<string | null>(null)

function onHover(node: FileNode | null): void {
  hoveredPath.value = node?.path ?? null
}

const contextMenu = ref<{ node: FileNode; x: number; y: number } | null>(null)

function onContextMenu(payload: { node: FileNode; x: number; y: number }): void {
  contextMenu.value = payload
}

async function showInFinder(node?: FileNode): Promise<void> {
  const target = node ?? contextMenu.value?.node ?? scanStore.selectedNode
  if (!target) return
  try {
    await window.api.showInFinder(target.path)
  } catch {
    // Path may no longer exist
  }
  contextMenu.value = null
}

async function openInTerminal(node?: FileNode): Promise<void> {
  const target = node ?? contextMenu.value?.node ?? scanStore.selectedNode
  if (!target) return
  try {
    await window.api.openInTerminal(target.path)
  } catch {
    // Path may no longer exist or is not a directory
  }
  contextMenu.value = null
}
</script>

<template>
  <div class="home">
    <div v-if="!scanStore.rootNode && !scanStore.isScanning" class="welcome">
      <p>Select a folder to visualise its disk usage.</p>
      <button @click="scanStore.selectAndScan()">Open Folder</button>
    </div>
    <div v-else-if="scanStore.isScanning && !scanStore.rootNode" class="welcome">
      <p class="scanning-text">Scanning…</p>
      <p v-if="scanStore.scanProgress" class="scanning-count">{{ scanStore.scanProgress.filesScanned.toLocaleString() }} files found</p>
      <p v-if="scanStore.scanProgress" class="scanning-path">{{ scanStore.scanProgress.currentPath }}</p>
    </div>
    <div v-else-if="viewRoot" class="viz-container">
      <BreadcrumbRootbar
        :view-root="viewRoot"
        @scan-other="scanOther"
        @rescan="rescan"
        @go-up="goUp"
        @navigate="navigateTo"
        @status-hint="(h) => statusHint = h"
      />
      <BreadcrumbToolbar
        :view-root="viewRoot"
        @select-node="scanStore.selectNode"
        @drill-into="drillIntoSelection"
        @show-in-finder="showInFinder()"
        @open-in-terminal="openInTerminal()"
        @select-parent="selectParent"
        @status-hint="(h) => statusHint = h"
      />
      <div class="viz-area">
        <TreemapView
          :data="viewRoot"
          :selected-node="scanStore.selectedNode"
          @select="scanStore.selectNode"
          @drill-down="onDrillDown"
          @hover="onHover"
          @context-menu="onContextMenu"
        />
        <div v-if="scanStore.isScanning" class="scan-overlay">
          <p class="scanning-text">Scanning…</p>
          <p v-if="scanStore.scanProgress" class="scanning-count">{{ scanStore.scanProgress.filesScanned.toLocaleString() }} files found</p>
          <p v-if="scanStore.scanProgress" class="scanning-path">{{ scanStore.scanProgress.currentPath }}</p>
        </div>
      </div>
      <div class="status-bar">
        <span v-if="statusHint" class="status-hint">{{ statusHint }}</span>
        <span v-else-if="contextMenu" class="status-path">{{ contextMenu.node.path }}</span>
        <span v-else-if="hoveredPath" class="status-path">{{ hoveredPath }}</span>
        <span v-else-if="scanStore.selectedNode" class="status-hint">{{ formatBytes(scanStore.selectedNode.size)  }}</span>
      </div>
    </div>
    <ContextMenu
      v-if="contextMenu"
      :x="contextMenu.x"
      :y="contextMenu.y"
      :node="contextMenu.node"
      @show-in-finder="showInFinder"
      @open-in-terminal="openInTerminal"
      @close="contextMenu = null"
    />
  </div>
</template>

<style scoped>
.home {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.welcome {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  text-align: center;
}

.welcome p {
  margin-bottom: 16px;
  font-size: 16px;
  color: var(--c-text-muted);
}

.welcome button {
  padding: 10px 24px;
  font-size: 14px;
  font-weight: 600;
  color: var(--c-primary-text);
  background: var(--c-primary-bg);
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s;
}

.welcome button:hover {
  background: var(--c-primary-hover);
}

.viz-container {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

.status-bar {
  display: flex;
  align-items: center;
  padding: 4px 12px;
  background: var(--c-surface);
  border-top: 1px solid var(--c-border);
  flex-shrink: 0;
  min-height: 24px;
}

.status-path {
  font-size: 11px;
  color: var(--c-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.status-hint {
  font-size: 11px;
  color: var(--c-text);
}

.viz-area {
  position: relative;
  flex: 1;
  min-height: 0;
}

.scan-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: var(--c-scan-overlay-bg);
  z-index: 10;
}

.scanning-text {
  font-size: 16px;
  color: var(--c-text-muted);
}

.scanning-count {
  font-size: 14px;
  color: var(--c-text-muted);
  margin-top: 8px;
}

.scanning-path {
  font-size: 11px;
  color: var(--c-text-dim);
  margin-top: 4px;
  max-width: 80%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  direction: rtl;
}
</style>
