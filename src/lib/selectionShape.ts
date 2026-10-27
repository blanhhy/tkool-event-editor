/** 一条横向色带（选区在某一行的矩形），坐标以内容左上角为原点 */
export interface SelectionBand {
  top: number;
  left: number;
  width: number;
  height: number;
}

type Point = [number, number];

/**
 * 把若干条横向色带合并成一个整体轮廓，并把每个转角都倒圆。
 * 相邻行拼成的凸角与凹角都会圆，不会出现逐行各自为政的小缺口。
 * 返回值用于 SVG：path 的 d，以及覆盖所有色带所需的宽高。
 */
export function selectionOutline(
  bands: SelectionBand[],
  radius: number,
): { d: string; width: number; height: number } | null {
  if (bands.length === 0) return null;

  const sorted = [...bands].sort((a, b) => a.top - b.top || a.left - b.left);

  // 纵向相接且横向有重叠的色带才连成一块；
  // 只是上下相邻但左右错开的，其实是两段互不相连的选区，各自成形
  const runs: SelectionBand[][] = [];
  for (const band of sorted) {
    const run = runs[runs.length - 1];
    const prev = run?.[run.length - 1];
    const joins =
      !!prev &&
      band.top > prev.top &&
      Math.abs(prev.top + prev.height - band.top) <= 1 &&
      Math.min(prev.left + prev.width, band.left + band.width) -
        Math.max(prev.left, band.left) >
        0;
    if (joins) {
      run.push(band);
    } else {
      runs.push([band]);
    }
  }

  let width = 0;
  let height = 0;
  const paths: string[] = [];

  for (const run of runs) {
    paths.push(roundedPath(outlinePoints(run), radius));
    for (const band of run) {
      width = Math.max(width, band.left + band.width);
      height = Math.max(height, band.top + band.height);
    }
  }

  return { d: paths.join(' '), width, height };
}

/** 一组纵向相接的色带的外轮廓顶点（顺时针，不含重复的起点） */
function outlinePoints(run: SelectionBand[]): Point[] {
  const right = (band: SelectionBand) => band.left + band.width;
  const bottom = (band: SelectionBand) => band.top + band.height;
  const first = run[0];
  const last = run[run.length - 1];
  const points: Point[] = [];

  // 上边：左 → 右
  points.push([first.left, first.top]);
  points.push([right(first), first.top]);

  // 右边：逐行向下，行宽变化处横向过渡
  for (let index = 0; index < run.length - 1; index += 1) {
    const current = right(run[index]);
    const next = right(run[index + 1]);
    if (current !== next) {
      points.push([current, bottom(run[index])]);
      points.push([next, bottom(run[index])]);
    }
  }
  points.push([right(last), bottom(last)]);

  // 下边：右 → 左
  points.push([last.left, bottom(last)]);

  // 左边：逐行向上，行宽变化处横向过渡
  for (let index = run.length - 1; index > 0; index -= 1) {
    const current = run[index].left;
    const next = run[index - 1].left;
    if (current !== next) {
      points.push([current, run[index].top]);
      points.push([next, run[index].top]);
    }
  }

  return points;
}

/** 直角多边形 → 每个顶点用二次贝塞尔倒圆的闭合路径 */
function roundedPath(points: Point[], radius: number): string {
  const count = points.length;
  let d = '';

  for (let index = 0; index < count; index += 1) {
    const prev = points[(index - 1 + count) % count];
    const current = points[index];
    const next = points[(index + 1) % count];

    const inLength = Math.hypot(current[0] - prev[0], current[1] - prev[1]);
    const outLength = Math.hypot(next[0] - current[0], next[1] - current[1]);
    if (inLength < 0.5 || outLength < 0.5) continue;

    // 圆角不超过两侧边长的一半，短边交界处也不会互相吃掉
    const inset = Math.min(radius, inLength / 2, outLength / 2);
    const startX = current[0] + ((prev[0] - current[0]) / inLength) * inset;
    const startY = current[1] + ((prev[1] - current[1]) / inLength) * inset;
    const endX = current[0] + ((next[0] - current[0]) / outLength) * inset;
    const endY = current[1] + ((next[1] - current[1]) / outLength) * inset;

    d += `${d ? 'L' : 'M'} ${startX} ${startY} `;
    d += `Q ${current[0]} ${current[1]} ${endX} ${endY} `;
  }

  return `${d}Z`;
}
