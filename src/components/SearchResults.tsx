import { useState } from 'react';
import { buildMatchExcerpt, type SearchGroup, type SearchMatch } from '../lib/eventSearch';
import { pageKey } from '../lib/events';
import ContextMenu from './ContextMenu';
import FileTypeIcon from './FileTypeIcon';
import { ChevronIcon } from './icons';

interface Props {
  groups: SearchGroup[];
  /** 单击匹配行：打开对应事件页并定位到该行 */
  onOpenMatch: (group: SearchGroup, match: SearchMatch) => void;
  /** 分组标题右键「打开」：在编辑器中打开并选中该页 */
  onOpenPage: (group: SearchGroup) => void;
  /** 分组标题右键「定位」：切到文件侧栏，在事件管理器中定位该页后打开 */
  onRevealPage: (group: SearchGroup) => void;
}

/** 搜索结果：按页分组，组内展示匹配行的单行节选 */
export default function SearchResults({ groups, onOpenMatch, onOpenPage, onRevealPage }: Props) {
  /** 收起的页（默认全部展开） */
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  /** 分组标题的右键菜单：以 pageKey 记录目标页 */
  const [menu, setMenu] = useState<{ x: number; y: number; key: string } | null>(null);

  const toggle = (key: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const menuGroup = menu ? groups.find((group) => pageKey(group.ref) === menu.key) ?? null : null;

  return (
    <div className="searchResults">
      {groups.map((group) => {
        const key = pageKey(group.ref);
        const open = !collapsed.has(key);

        return (
          <section key={key} className="searchGroup">
            <button
              type="button"
              className="searchGroupHeader"
              aria-expanded={open}
              title={`${group.name}  ${group.path}`}
              onClick={() => toggle(key)}
              onContextMenu={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setMenu({ x: event.clientX, y: event.clientY, key });
              }}
            >
              <span className="chevron" data-expanded={open ? 'true' : 'false'}>
                <ChevronIcon size={12} />
              </span>
              <FileTypeIcon icon="code" size={16} />
              <span className="searchGroupName">{group.name}</span>
              <span className="searchGroupPath">{group.path}</span>
              <span className="searchCount">{group.matches.length}</span>
            </button>
            {open && (
              <ul className="searchMatches">
                {group.matches.map((match, index) => {
                  const excerpt = buildMatchExcerpt(match.text, match.offset, match.length);
                  return (
                    <li
                      key={index}
                      className="searchMatch"
                      title={match.text}
                      onClick={() => onOpenMatch(group, match)}
                    >
                      <span className="searchMatchDot" />
                      <span className="searchMatchText">
                        {excerpt.before}
                        <mark className="searchMatchMark">{excerpt.match}</mark>
                        {excerpt.after}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
      {menu && menuGroup && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          items={[
            {
              id: 'toggle',
              label: collapsed.has(menu.key) ? '展开' : '折叠',
              onSelect: () => toggle(menu.key),
            },
            {
              id: 'open',
              label: '打开',
              separatorBefore: true,
              onSelect: () => onOpenPage(menuGroup),
            },
            { id: 'reveal', label: '定位', onSelect: () => onRevealPage(menuGroup) },
          ]}
        />
      )}
    </div>
  );
}
