import { useEffect, useRef } from 'react';
import {
  EVENT_CATEGORY_LABELS,
  eventPageDisplayName,
  formatEventLabel,
  formatMapEventLabel,
  formatMapLabel,
  isCatalogEmpty,
  pageKey,
  type EventCatalog,
  type EventObject,
  type EventPage,
} from '../lib/events';
import FileTypeIcon from './FileTypeIcon';
import { TreeBranch } from './SidePanelSection';

interface Props {
  catalog: EventCatalog;
  hasProject: boolean;
  /** 当前选中事件页的 pageKey */
  selected: string | null;
  onSelectPage: (page: EventPage, label: string) => void;
  loading?: boolean;
  progress?: { done: number; total: number } | null;
  error?: string | null;
  /** 定位请求：展开目标页上方的路径并滚动到可见范围 */
  reveal?: { key: string; seq: number } | null;
}

/** 定位目标是否在指定的事件对象下（key 为 pageKey） */
function isUnderEvent(key: string | null, event: EventObject, mapId?: number): boolean {
  if (!key) return false;
  switch (event.category) {
    case 'common':
      return key.startsWith(`common/${event.id}/`);
    case 'troop':
      return key.startsWith(`troop/${event.id}/`);
    case 'map':
      return key.startsWith(`map/${mapId}/event/${event.id}/`);
  }
}

export default function EventManager({
  catalog,
  hasProject,
  selected,
  onSelectPage,
  loading = false,
  progress = null,
  error = null,
  reveal = null,
}: Props) {
  const treeRef = useRef<HTMLDivElement>(null);
  const revealKey = reveal?.key ?? null;
  const revealSeq = reveal?.seq ?? 0;

  useEffect(() => {
    if (!revealKey) return;

    let frame = 0;
    let tries = 0;
    const scrollToRow = () => {
      const row = treeRef.current?.querySelector<HTMLElement>(
        `[data-page-key="${revealKey}"]`,
      );
      if (row) {
        row.scrollIntoView({ block: 'nearest' });
        return;
      }
      // 上方路径的展开在子组件的 effect 里完成，等一帧再找目标行
      if (tries < 10) {
        tries += 1;
        frame = requestAnimationFrame(scrollToRow);
      }
    };
    frame = requestAnimationFrame(scrollToRow);

    return () => cancelAnimationFrame(frame);
  }, [revealKey, revealSeq]);

  if (!hasProject) {
    return <div className="treeEmpty">未打开工程</div>;
  }

  if (error) {
    return <div className="treeEmpty">{error}</div>;
  }

  if (isCatalogEmpty(catalog)) {
    return <div className="treeEmpty">{loading ? '正在读取事件…' : '未找到事件'}</div>;
  }

  return (
    <div ref={treeRef} className="tree eventTree" role="tree" aria-label="事件">
      {loading && progress && (
        <div className="treeHint">
          {`正在解析地图事件 ${progress.done}/${progress.total}`}
        </div>
      )}
      <TreeBranch
        label={EVENT_CATEGORY_LABELS.common}
        icon={<FileTypeIcon icon="folder" size={16} />}
        depth={0}
        count={catalog.commonEvents.length}
        expandSeq={revealKey?.startsWith('common/') ? revealSeq : undefined}
      >
        {catalog.commonEvents.map((event) => (
          <EventObjectRow
            key={`common-${event.id}`}
            event={event}
            depth={1}
            selected={selected}
            onSelectPage={onSelectPage}
            expandSeq={isUnderEvent(revealKey, event) ? revealSeq : undefined}
          />
        ))}
      </TreeBranch>

      <TreeBranch
        label={EVENT_CATEGORY_LABELS.map}
        icon={<FileTypeIcon icon="folder" size={16} />}
        depth={0}
        count={catalog.maps.length}
        defaultOpen
        expandSeq={revealKey?.startsWith('map/') ? revealSeq : undefined}
      >
        {catalog.maps.map((map) => (
          <TreeBranch
            key={`map-${map.id}`}
            label={formatMapLabel(map.id, map.name)}
            icon={<FileTypeIcon icon="package" size={16} />}
            depth={1}
            count={map.events.length}
            expandSeq={revealKey?.startsWith(`map/${map.id}/`) ? revealSeq : undefined}
          >
            {map.events.map((event) => (
              <EventObjectRow
                key={`map-${map.id}-${event.id}`}
                event={event}
                depth={2}
                selected={selected}
                onSelectPage={onSelectPage}
                expandSeq={isUnderEvent(revealKey, event, map.id) ? revealSeq : undefined}
              />
            ))}
          </TreeBranch>
        ))}
      </TreeBranch>

      <TreeBranch
        label={EVENT_CATEGORY_LABELS.troop}
        icon={<FileTypeIcon icon="folder" size={16} />}
        depth={0}
        count={catalog.troops.length}
        expandSeq={revealKey?.startsWith('troop/') ? revealSeq : undefined}
      >
        {catalog.troops.map((event) => (
          <EventObjectRow
            key={`troop-${event.id}`}
            event={event}
            depth={1}
            selected={selected}
            onSelectPage={onSelectPage}
            expandSeq={isUnderEvent(revealKey, event) ? revealSeq : undefined}
          />
        ))}
      </TreeBranch>
    </div>
  );
}

function EventObjectRow({
  event,
  depth,
  selected,
  onSelectPage,
  expandSeq,
}: {
  event: EventObject;
  depth: number;
  selected: string | null;
  onSelectPage: (page: EventPage, label: string) => void;
  expandSeq?: number;
}) {
  // 地图事件用 EV0001 这类编号；名字就是默认名时不再重复显示
  const eventLabel =
    event.category === 'map'
      ? formatMapEventLabel(event.id, event.name)
      : formatEventLabel(event.id, event.name);
  // 页名（标签页标题）：只用事件名，不拼编号
  const pageLabel = eventPageDisplayName(event);

  return (
    <TreeBranch
      label={eventLabel}
      icon={<FileTypeIcon icon="object" size={16} />}
      depth={depth}
      count={event.pages.length}
      expandSeq={expandSeq}
    >
      {event.pages.map((page) => (
        <PageRow
          key={pageKey(page.ref)}
          page={page}
          depth={depth + 1}
          selected={selected}
          onSelectPage={onSelectPage}
          selectLabel={event.pages.length > 1 ? `${pageLabel} · 页${page.index}` : pageLabel}
        />
      ))}
    </TreeBranch>
  );
}

function PageRow({
  page,
  depth,
  selected,
  onSelectPage,
  selectLabel,
}: {
  page: EventPage;
  depth: number;
  selected: string | null;
  onSelectPage: (page: EventPage, label: string) => void;
  selectLabel: string;
}) {
  const key = pageKey(page.ref);
  const active = selected === key;
  const label = `事件页 ${page.index}`;

  return (
    <div
      className="treeRow"
      role="treeitem"
      aria-selected={active}
      data-kind="file"
      data-selected={active ? 'true' : undefined}
      data-page-key={key}
      tabIndex={0}
      style={{ paddingLeft: 6 + depth * 14 }}
      onClick={() => onSelectPage(page, selectLabel)}
      onMouseDown={(event) => event.currentTarget.focus()}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelectPage(page, selectLabel);
        }
      }}
    >
      <span className="chevronPlaceholder" />
      <FileTypeIcon icon="code" size={16} />
      <span className="treeLabel" title={label}>
        {label}
      </span>
    </div>
  );
}
