import {
  EVENT_CATEGORY_LABELS,
  countEventPages,
  formatEventLabel,
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
  onSelectPage: (page: EventPage) => void;
}

export default function EventManager({ catalog, hasProject, selected, onSelectPage }: Props) {
  if (!hasProject) {
    return <div className="treeEmpty">未打开工程</div>;
  }

  const pageCount = countEventPages(catalog);
  if (isCatalogEmpty(catalog) || pageCount === 0) {
    return <div className="treeEmpty">暂未解析到事件</div>;
  }

  return (
    <div className="tree eventTree" role="tree" aria-label="事件">
      <TreeBranch
        label={EVENT_CATEGORY_LABELS.common}
        icon={<FileTypeIcon icon="folder" size={16} />}
        depth={0}
        count={catalog.commonEvents.length}
      >
        {catalog.commonEvents.map((event) => (
          <EventObjectRow
            key={`common-${event.id}`}
            event={event}
            depth={1}
            selected={selected}
            onSelectPage={onSelectPage}
          />
        ))}
      </TreeBranch>

      <TreeBranch
        label={EVENT_CATEGORY_LABELS.map}
        icon={<FileTypeIcon icon="folder" size={16} />}
        depth={0}
        count={catalog.maps.length}
        defaultOpen
      >
        {catalog.maps.map((map) => (
          <TreeBranch
            key={`map-${map.id}`}
            label={formatMapLabel(map.id, map.name)}
            icon={<FileTypeIcon icon="package" size={16} />}
            depth={1}
            count={map.events.length}
          >
            {map.events.map((event) => (
              <EventObjectRow
                key={`map-${map.id}-${event.id}`}
                event={event}
                depth={2}
                selected={selected}
                onSelectPage={onSelectPage}
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
      >
        {catalog.troops.map((event) => (
          <EventObjectRow
            key={`troop-${event.id}`}
            event={event}
            depth={1}
            selected={selected}
            onSelectPage={onSelectPage}
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
}: {
  event: EventObject;
  depth: number;
  selected: string | null;
  onSelectPage: (page: EventPage) => void;
}) {
  return (
    <TreeBranch
      label={formatEventLabel(event.id, event.name)}
      icon={<FileTypeIcon icon="object" size={16} />}
      depth={depth}
      count={event.pages.length}
    >
      {event.pages.map((page) => (
        <PageRow
          key={pageKey(page.ref)}
          page={page}
          depth={depth + 1}
          selected={selected}
          onSelectPage={onSelectPage}
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
}: {
  page: EventPage;
  depth: number;
  selected: string | null;
  onSelectPage: (page: EventPage) => void;
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
      tabIndex={0}
      style={{ paddingLeft: 6 + depth * 14 }}
      onClick={() => onSelectPage(page)}
      onMouseDown={(event) => event.currentTarget.focus()}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelectPage(page);
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
