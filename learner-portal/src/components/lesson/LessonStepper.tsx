import {
  Box,
  IconButton,
  Step,
  StepButton,
  Stepper,
} from "@mui/material";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import RestartAltRoundedIcon from "@mui/icons-material/RestartAltRounded";
import { useMemo } from "react";

type LessonStepperProps = {
  openSection: string;
  completedSections: Record<string, boolean>;
  onOpenSection: (section: string) => void;
  canNavigateTo: (section: string) => boolean;
  sectionKeys: string[];
  onReset: () => void;
};

const getBaseKey = (key: string) => {
  const match = key.match(/^([a-z_]+)-\d+$/);
  return match ? match[1] : key;
};

const getStepLabel = (key: string) => {
  const match = key.match(/^([a-z_]+)-(\d+)$/);
  const baseKey = getBaseKey(key);
  const baseLabel =
    baseKey.charAt(0).toUpperCase() + baseKey.slice(1);
  if (!match) {
    return baseLabel;
  }
  return `${baseLabel} ${match[2]}`;
};

const LessonStepper = ({
  openSection,
  completedSections,
  onOpenSection,
  canNavigateTo,
  sectionKeys,
  onReset,
}: LessonStepperProps) => {
  const orderedKeys = useMemo(() => sectionKeys.filter((key) => key), [sectionKeys]);
  return (
    <Box className="lesson-stepper">
      <Box className="lesson-stepper-inner">
        <Stepper nonLinear activeStep={orderedKeys.indexOf(openSection)}>
          {orderedKeys.map((sectionKey) => (
            <Step
              key={sectionKey}
              completed={completedSections[sectionKey]}
            >
              <StepButton
                onClick={() => onOpenSection(sectionKey)}
                disabled={!canNavigateTo(sectionKey)}
                sx={{
                  "& .MuiStepLabel-label": {
                    color: completedSections[sectionKey]
                      ? "success.main"
                      : sectionKey === openSection
                      ? "primary.main"
                      : "text.disabled",
                    fontWeight: completedSections[sectionKey] ? 600 : 500,
                  },
                }}
                icon={
                  <CheckCircleRoundedIcon
                    sx={{
                      color:
                        completedSections[sectionKey]
                          ? "success.main"
                          : sectionKey === openSection
                          ? "primary.main"
                          : "text.disabled",
                    }}
                  />
                }
              >
                {getStepLabel(sectionKey)}
              </StepButton>
            </Step>
          ))}
        </Stepper>
      </Box>
      <IconButton className="lesson-stepper-reset" onClick={onReset}>
        <RestartAltRoundedIcon />
      </IconButton>
    </Box>
  );
};

export default LessonStepper;
