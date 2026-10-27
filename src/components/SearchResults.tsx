import { useState } from 'react';
import { buildMatchExcerpt, type SearchGroup } from '../lib/eventSearch';
import { pageKey } from '../lib/events';
import FileTypeIcon from './FileTypeIcon';
import { ChevronIcon } from './icons';

interface Props {
  groups: SearchGroup[];
}

/** 搜索结果：按页分组，组内展示匹配行的单行节选 */
export default function SearchResults({ groups }: Props) {
  /** 收起的页（默认全部展开） */
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const toggle = (key: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

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
                  const excerpt = buildMatchExcerpt(match.text, match.index, match.length);
                  return (
                    <li key={index} className="searchMatch" title={match.text}>
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
    </div>
  );
}
