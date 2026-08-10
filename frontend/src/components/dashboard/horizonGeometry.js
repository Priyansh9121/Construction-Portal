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
 * 5 volumes, 14 storey datums, one dimension line.
 */

const HORIZON = {
  "W": 1600,
  "H": 200,
  "GROUND": 168,
  "blocks": [
    {
      "x": 176,
      "w": 168,
      "h": 84,
      "y": 84
    },
    {
      "x": 356,
      "w": 120,
      "h": 116,
      "y": 52
    },
    {
      "x": 488,
      "w": 216,
      "h": 148,
      "y": 20
    },
    {
      "x": 716,
      "w": 96,
      "h": 96,
      "y": 72
    },
    {
      "x": 824,
      "w": 144,
      "h": 62,
      "y": 106
    }
  ],
  "datums": [
    [
      {
        "x1": 176,
        "x2": 344,
        "y": 154
      },
      {
        "x1": 176,
        "x2": 344,
        "y": 128
      }
    ],
    [
      {
        "x1": 356,
        "x2": 476,
        "y": 154
      },
      {
        "x1": 356,
        "x2": 476,
        "y": 128
      },
      {
        "x1": 356,
        "x2": 476,
        "y": 102
      }
    ],
    [
      {
        "x1": 488,
        "x2": 704,
        "y": 154
      },
      {
        "x1": 488,
        "x2": 704,
        "y": 128
      },
      {
        "x1": 488,
        "x2": 704,
        "y": 102
      },
      {
        "x1": 488,
        "x2": 704,
        "y": 76
      },
      {
        "x1": 488,
        "x2": 704,
        "y": 50
      }
    ],
    [
      {
        "x1": 716,
        "x2": 812,
        "y": 154
      },
      {
        "x1": 716,
        "x2": 812,
        "y": 128
      },
      {
        "x1": 716,
        "x2": 812,
        "y": 102
      }
    ],
    [
      {
        "x1": 824,
        "x2": 968,
        "y": 154
      }
    ]
  ],
  "rig": {
    "x": 640,
    "apex": -34,
    "jib": -18,
    "from": 512,
    "to": 872,
    "hoist": 800,
    "load": 40,
    "base": 168
  },
  "dimension": {
    "x": 148,
    "top": 20,
    "bottom": 168,
    "label": "7400 MM"
  }
};

export default HORIZON;
