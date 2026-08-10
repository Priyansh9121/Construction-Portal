/*
 * GENERATED — do not edit by hand.
 * Source: tools/scene/generate_horizon.py
 *
 * An orthographic site elevation for the workspace's environmental
 * band. Drawn in line rather than fill, because the workspace speaks
 * Architectural Instrument and the threshold speaks Cinematic Site
 * Intelligence — reusing the login skyline here would import the
 * wrong grammar onto an operational surface.
 *
 * 5 volumes, 6 storey datums, one dimension line.
 */

const HORIZON = {
  "W": 1600,
  "H": 150,
  "GROUND": 132,
  "blocks": [
    {
      "x": 176,
      "w": 168,
      "h": 46,
      "y": 86
    },
    {
      "x": 356,
      "w": 120,
      "h": 64,
      "y": 68
    },
    {
      "x": 488,
      "w": 216,
      "h": 88,
      "y": 44
    },
    {
      "x": 716,
      "w": 96,
      "h": 54,
      "y": 78
    },
    {
      "x": 824,
      "w": 144,
      "h": 34,
      "y": 98
    }
  ],
  "datums": [
    [],
    [
      {
        "x1": 356,
        "x2": 476,
        "y": 116
      },
      {
        "x1": 356,
        "x2": 476,
        "y": 94
      }
    ],
    [
      {
        "x1": 488,
        "x2": 704,
        "y": 116
      },
      {
        "x1": 488,
        "x2": 704,
        "y": 94
      },
      {
        "x1": 488,
        "x2": 704,
        "y": 72
      }
    ],
    [
      {
        "x1": 716,
        "x2": 812,
        "y": 116
      }
    ],
    []
  ],
  "rig": {
    "x": 700,
    "apex": 14,
    "jib": 28,
    "from": 610,
    "to": 950,
    "hoist": 876,
    "load": 72,
    "base": 132
  },
  "dimension": {
    "x": 150,
    "top": 44,
    "bottom": 132,
    "label": "4400 MM"
  }
};

export default HORIZON;
