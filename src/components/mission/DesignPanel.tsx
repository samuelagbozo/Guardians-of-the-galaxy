import {
  ANTENNAS,
  BUSES,
  INSTRUMENTS,
  LAUNCHERS,
  POWER,
} from "../../data";
import type { Sel } from "../../engine";
import { MissionCard, partStats, ResourceMargins, SectionHeading } from "../MissionUi";

export function DesignPanel({
  selection,
  margins,
  onUpdateSelection,
  onToggleInstrument,
}: {
  selection: Sel;
  margins: Parameters<typeof ResourceMargins>[0]["margins"];
  onUpdateSelection: (patch: Partial<Sel>) => void;
  onToggleInstrument: (id: string) => void;
}) {
  return (
    <>
      <SectionHeading>Live resources</SectionHeading>
      <ResourceMargins margins={margins} />
      <SectionHeading>Instruments</SectionHeading>
      {INSTRUMENTS.filter((item) =>
        item.objectives?.includes(selection.objectiveId),
      ).map((item) => (
        <MissionCard
          key={item.id}
          active={selection.instrumentIds.includes(item.id)}
          onClick={() => onToggleInstrument(item.id)}
          title={item.name}
          sub={partStats(item)}
        >
          {item.desc}
        </MissionCard>
      ))}
      <SectionHeading>Power system</SectionHeading>
      {POWER.map((item) => (
        <MissionCard
          key={item.id}
          active={selection.powerId === item.id}
          onClick={() => onUpdateSelection({ powerId: item.id })}
          title={item.name}
          sub={partStats(item)}
        >
          {item.desc}
        </MissionCard>
      ))}
      <SectionHeading>Antenna</SectionHeading>
      {ANTENNAS.map((item) => (
        <MissionCard
          key={item.id}
          active={selection.antennaId === item.id}
          onClick={() => onUpdateSelection({ antennaId: item.id })}
          title={item.name}
          sub={partStats(item)}
        >
          {item.desc}
        </MissionCard>
      ))}
      <SectionHeading>Spacecraft bus</SectionHeading>
      {BUSES.map((item) => (
        <MissionCard
          key={item.id}
          active={selection.busId === item.id}
          onClick={() => onUpdateSelection({ busId: item.id })}
          title={item.name}
          sub={partStats(item)}
        >
          {item.desc}
        </MissionCard>
      ))}
      <SectionHeading>Launch vehicle</SectionHeading>
      {LAUNCHERS.map((item) => (
        <MissionCard
          key={item.id}
          active={selection.launchId === item.id}
          onClick={() => onUpdateSelection({ launchId: item.id })}
          title={item.name}
          sub={partStats(item)}
        >
          {item.desc}
        </MissionCard>
      ))}
    </>
  );
}
