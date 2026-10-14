export function calculateOverlapPercentage(rectA, rectB) {
  // rectA, rectB: { x, y, width, height }
  const xOverlap = Math.max(
    0,
    Math.min(rectA.x + rectA.width, rectB.x + rectB.width) - Math.max(rectA.x, rectB.x)
  );
  const yOverlap = Math.max(
    0,
    Math.min(rectA.y + rectA.height, rectB.y + rectB.height) - Math.max(rectA.y, rectB.y)
  );

  const overlapArea = xOverlap * yOverlap;
  if (overlapArea <= 0) return 0;

  const minArea = Math.min(rectA.width * rectA.height, rectB.width * rectB.height);
  return minArea > 0 ? overlapArea / minArea : 0;
}

export function detectClusters(dots, collapsedSize = 48, threshold = 0.5) {
  // Groups dots into clusters if bounding box overlap exceeds threshold (default 50%)
  const clusters = [];
  const visited = new Set();

  for (let i = 0; i < dots.length; i++) {
    if (visited.has(dots[i].id)) continue;

    const clusterGroup = [dots[i]];
    visited.add(dots[i].id);

    const rectA = {
      x: dots[i].position.x,
      y: dots[i].position.y,
      width: collapsedSize,
      height: collapsedSize
    };

    for (let j = i + 1; j < dots.length; j++) {
      if (visited.has(dots[j].id)) continue;

      const rectB = {
        x: dots[j].position.x,
        y: dots[j].position.y,
        width: collapsedSize,
        height: collapsedSize
      };

      const overlap = calculateOverlapPercentage(rectA, rectB);
      if (overlap >= threshold) {
        clusterGroup.push(dots[j]);
        visited.add(dots[j].id);
      }
    }

    if (clusterGroup.length > 1) {
      // Calculate centroid
      const totalX = clusterGroup.reduce((sum, d) => sum + d.position.x, 0);
      const totalY = clusterGroup.reduce((sum, d) => sum + d.position.y, 0);
      clusters.push({
        clusterId: `cluster-${clusterGroup.map((d) => d.id).join('-')}`,
        centroid: {
          x: Math.round(totalX / clusterGroup.length),
          y: Math.round(totalY / clusterGroup.length)
        },
        dotIds: clusterGroup.map((d) => d.id),
        count: clusterGroup.length
      });
    }
  }

  return clusters;
}
