import type { CommandLine } from '../lib/eventCommands';

interface Props {
  title: string;
  commands: CommandLine[];
  loading: boolean;
  error: string | null;
}

export default function EventPageView({ title, commands, loading, error }: Props) {
  return (
    <div className="eventPageView">
      <div className="eventPageHeader">
        <span className="eventPageTitle" title={title}>
          {title}
        </span>
        {!loading && !error && <span className="eventPageMeta">{`${commands.length} 条指令`}</span>}
      </div>

      {loading && <div className="eventPageEmpty">读取事件页…</div>}
      {!loading && error && <div className="eventPageEmpty eventPageError">{error}</div>}
      {!loading && !error && commands.length === 0 && (
        <div className="eventPageEmpty">事件页没有指令</div>
      )}

      {!loading && !error && commands.length > 0 && (
        <div className="commandList" role="list">
          {commands.map((line) => (
            <div key={line.index} className="commandRow" role="listitem">
              <span className="commandIndex">{line.index + 1}</span>
              <div
                className="commandContent"
                data-role={line.role}
                data-unknown={line.unknown ? 'true' : undefined}
                style={{ paddingLeft: line.indent * 18 }}
              >
                <span className="commandName">{line.name}</span>
                {line.params.length > 0 && (
                  <span className="commandParams">{line.params.join(', ')}</span>
                )}
                {line.text && <span className="commandText">{line.text}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
