import { EnvironmentFilled, RobotOutlined } from '@ant-design/icons';
import { readDeploymentPoints, subscribeDeploymentPoints, type DeploymentPoint } from './deploymentPoints';
import { useEffect, useState } from 'react';

type Props = {
  points?: DeploymentPoint[];
  editable?: boolean;
  selectedId?: string;
  onSelect?: (id: string) => void;
  onDragStart?: (event: React.DragEvent<HTMLButtonElement>, point: DeploymentPoint) => void;
  onDragOver?: (event: React.DragEvent<HTMLDivElement>) => void;
  onDrop?: (event: React.DragEvent<HTMLDivElement>) => void;
};

export default function AgentMapCanvas({ points: pointsProp, editable = false, selectedId, onSelect, onDragStart, onDragOver, onDrop }: Props) {
  const [savedPoints, setSavedPoints] = useState(readDeploymentPoints);
  useEffect(() => subscribeDeploymentPoints(() => setSavedPoints(readDeploymentPoints())), []);
  const points = pointsProp ?? savedPoints;
  return <div className={`hospital-agent-map${editable ? ' agent-map-editable' : ''}`} aria-label="医院智能体分布地图" onDragOver={onDragOver} onDrop={onDrop}>
    <div className="hospital-campus" aria-hidden="true"><i className="campus-building campus-building--a" /><i className="campus-building campus-building--b" /><i className="campus-building campus-building--c" /><i className="campus-building campus-building--d" /><i className="campus-building campus-building--e" /><i className="campus-building campus-building--f" /><i className="campus-road campus-road--a" /><i className="campus-road campus-road--b" /></div>
    <div className="hospital-map-caption"><EnvironmentFilled /> 院区数字孪生地图 <span>· {points.length} 个部署点位</span></div>
    {points.map(point => <button key={point.id} type="button" draggable={editable} onDragStart={event => onDragStart?.(event, point)} onClick={() => onSelect?.(point.id)} className={`agent-map-point agent-map-point--popover-${point.popover}${selectedId === point.id ? ' is-selected' : ''}`} style={{ left: `${point.x}%`, top: `${point.y}%`, cursor: editable ? 'move' : 'pointer' }} aria-label={`查看${point.name}360画像`}>
      <span className="agent-map-pin"><RobotOutlined /></span><span className="agent-map-pulse"/><span className="agent-map-popover"><b>{point.name}<em>{point.version}</em><span>{point.status}</span></b><span>科室：{point.department}</span></span>
    </button>)}
  </div>;
}
