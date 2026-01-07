import {
  Box,
  IconButton,
  Step,
  StepButton,
  Stepper,
} from "@mui/material";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import RestartAltRoundedIcon from "@mui/icons-material/RestartAltRounded";
import { LessonSectionKey } from "../../state/types";

type LessonStepperProps = {
  openSection: LessonSectionKey;
  completedSections: Record<LessonSectionKey, boolean>;
  onOpenSection: (section: LessonSectionKey) => void;
  canNavigateTo: (section: LessonSectionKey) => boolean;
  onReset: () => void;
};

const sectionOrder: LessonSectionKey[] = ["references", "lesson", "exercises"];

const getStepLabel = (key: LessonSectionKey) => {
  if (key === "lesson") {
    return "Lesson";
  }
  if (key === "references") {
    return "References";
  }
  return "Exercises";
};

const LessonStepper = ({
  openSection,
  completedSections,
  onOpenSection,
  canNavigateTo,
  onReset,
}: LessonStepperProps) => {
  return (
    <Box className="lesson-stepper">
      <Box className="lesson-stepper-inner">
        <Stepper nonLinear activeStep={sectionOrder.indexOf(openSection)}>
          {sectionOrder.map((sectionKey) => (
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
