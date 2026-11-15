import { OBJECTIVES, ORBITS } from "../../data";
import { usd, type Sel } from "../../engine";
import { MissionCard, SectionHeading } from "../MissionUi";

export function ObjectivePanel({
  selection,
  onSelectObjective,
  onSelectOrbit,
}: {
  selection: Sel;
  onSelectObjective: (id: string) => void;
  onSelectOrbit: (id: string) => void;
}) {
  const objective = OBJECTIVES.find((item) => item.id === selection.objectiveId)!;

  return (
    <>
      <SectionHeading>Mission objective</SectionHeading>
      {OBJECTIVES.map((item) => (
        <MissionCard
          key={item.id}
          active={item.id === selection.objectiveId}
          onClick={() => onSelectObjective(item.id)}
          title={item.name}
          sub={`Budget ${usd(item.budgetUsd)}`}
        >
          {item.goal}
        </MissionCard>
      ))}
      <SectionHeading>Orbit</SectionHeading>
      {ORBITS.filter((orbit) => objective.orbitIds.includes(orbit.id)).map(
        (orbit) => (
          <MissionCard
            key={orbit.id}
            active={orbit.id === selection.orbitId}
            onClick={() => onSelectOrbit(orbit.id)}
            title={orbit.name}
            sub={`${orbit.altKm.toLocaleString()} km`}
          >
            {orbit.desc}
          </MissionCard>
        ),
      )}
    </>
  );
}
