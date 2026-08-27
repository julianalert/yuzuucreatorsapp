import "server-only";
import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import type { SkeletonSection } from "./blueprint/types";

const styles = StyleSheet.create({
  page: {
    paddingTop: 64,
    paddingBottom: 72,
    paddingHorizontal: 68,
    backgroundColor: "#F7F8F4",
    fontFamily: "Times-Roman",
    fontSize: 11.5,
    lineHeight: 1.65,
    color: "#16201B",
  },
  micro: {
    fontFamily: "Courier",
    fontSize: 7.5,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: "#6E7C73",
    marginBottom: 10,
  },
  coverTitle: { fontSize: 30, lineHeight: 1.15, marginTop: 10, marginBottom: 18 },
  coverSub: { fontSize: 12.5, color: "#3D4B43", lineHeight: 1.6 },
  verdict: {
    marginTop: 36,
    padding: 18,
    backgroundColor: "#FFFFFF",
    border: "1px solid #D9DED4",
    borderRadius: 6,
  },
  verdictTitle: { fontSize: 16, marginTop: 4, marginBottom: 6 },
  h2: { fontSize: 19, marginBottom: 12, marginTop: 6 },
  para: { marginBottom: 10, color: "#26312B" },
  footer: {
    position: "absolute",
    bottom: 36,
    left: 68,
    right: 68,
    flexDirection: "row",
    justifyContent: "space-between",
    fontFamily: "Courier",
    fontSize: 7.5,
    color: "#9AA89F",
  },
  zest: { color: "#8A9A19" },
});

export interface PlanPdfProps {
  topicTitle: string;
  creatorName: string;
  archetypeLabel: string;
  archetypeNote?: string;
  sections: { id: string; title: string; prose: string }[];
  forLine?: string;
}

function Footer({ creatorName }: { creatorName: string }) {
  return (
    <View style={styles.footer} fixed>
      <Text>
        yuzuu<Text style={styles.zest}>.</Text>
      </Text>
      <Text>{creatorName}</Text>
      <Text
        render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
      />
    </View>
  );
}

export function PlanDocument(props: PlanPdfProps) {
  return (
    <Document title={props.topicTitle} author={props.creatorName}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.micro}>
          {props.forLine ?? `Written by ${props.creatorName}`}
        </Text>
        <Text style={styles.coverTitle}>{props.topicTitle}</Text>
        <Text style={styles.coverSub}>
          A thirty-day plan written for you — not a generic guide with your name
          pasted in.
        </Text>
        <View style={styles.verdict}>
          <Text style={styles.micro}>What we think is going on</Text>
          <Text style={styles.verdictTitle}>{props.archetypeLabel}</Text>
          {props.archetypeNote ? (
            <Text style={{ fontSize: 10.5, color: "#6E7C73", lineHeight: 1.55 }}>
              {props.archetypeNote}
            </Text>
          ) : null}
        </View>
        <Footer creatorName={props.creatorName} />
      </Page>

      {props.sections.map((s) => (
        <Page key={s.id} size="A4" style={styles.page}>
          <Text style={styles.micro}>{props.topicTitle}</Text>
          <Text style={styles.h2}>{s.title}</Text>
          {s.prose
            .split(/\n{2,}/)
            .map((p) => p.trim())
            .filter(Boolean)
            .map((p, i) => (
              <Text key={i} style={styles.para}>
                {p}
              </Text>
            ))}
          <Footer creatorName={props.creatorName} />
        </Page>
      ))}
    </Document>
  );
}

export async function renderPlanPdf(props: PlanPdfProps): Promise<Buffer> {
  return renderToBuffer(<PlanDocument {...props} />);
}

export function sectionsForPdf(
  skeleton: SkeletonSection[],
  rendered: Record<string, string>
): { id: string; title: string; prose: string }[] {
  return skeleton
    .filter((s) => rendered[s.id])
    .map((s) => ({ id: s.id, title: s.title, prose: rendered[s.id] }));
}
