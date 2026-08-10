/*
 * GENERATED — do not edit by hand.
 *
 * Source: tools/scene/generate_skyline.py
 * Regenerate:
 *   python3 tools/scene/generate_skyline.py \
 *     > frontend/src/components/auth/sceneGeometry.js
 *
 * Every proportion here is derived, and the generator asserts the
 * two constraints that were previously got wrong by hand: the rig
 * stands clear of the skyline, and nothing essential leaves the
 * safe area that `preserveAspectRatio="slice"` guarantees.
 *
 * 5 blocks, 18 floor plates, 5 lit windows.
 */

const SCENE = {
  "W": 1600,
  "H": 900,
  "HORIZON": 720,
  "safeTop": 340,
  "safeX": [
    200,
    1400
  ],
  "massing": [
    {
      "x": 392,
      "w": 176,
      "h": 210,
      "y": 510
    },
    {
      "x": 568,
      "w": 138,
      "h": 150,
      "y": 570
    },
    {
      "x": 706,
      "w": 190,
      "h": 240,
      "y": 480
    },
    {
      "x": 896,
      "w": 122,
      "h": 180,
      "y": 540
    },
    {
      "x": 1018,
      "w": 158,
      "h": 128,
      "y": 592
    }
  ],
  "floors": [
    [
      {
        "x1": 400,
        "x2": 560,
        "y": 690
      },
      {
        "x1": 400,
        "x2": 560,
        "y": 652
      },
      {
        "x1": 400,
        "x2": 560,
        "y": 614
      },
      {
        "x1": 400,
        "x2": 560,
        "y": 576
      }
    ],
    [
      {
        "x1": 576,
        "x2": 698,
        "y": 690
      },
      {
        "x1": 576,
        "x2": 698,
        "y": 652
      },
      {
        "x1": 576,
        "x2": 698,
        "y": 614
      }
    ],
    [
      {
        "x1": 714,
        "x2": 888,
        "y": 690
      },
      {
        "x1": 714,
        "x2": 888,
        "y": 652
      },
      {
        "x1": 714,
        "x2": 888,
        "y": 614
      },
      {
        "x1": 714,
        "x2": 888,
        "y": 576
      },
      {
        "x1": 714,
        "x2": 888,
        "y": 538
      }
    ],
    [
      {
        "x1": 904,
        "x2": 1010,
        "y": 690
      },
      {
        "x1": 904,
        "x2": 1010,
        "y": 652
      },
      {
        "x1": 904,
        "x2": 1010,
        "y": 614
      },
      {
        "x1": 904,
        "x2": 1010,
        "y": 576
      }
    ],
    [
      {
        "x1": 1026,
        "x2": 1168,
        "y": 690
      },
      {
        "x1": 1026,
        "x2": 1168,
        "y": 652
      }
    ]
  ],
  "rig": {
    "x": 800,
    "apex": 350,
    "jib": 374,
    "jibFrom": 711,
    "jibTo": 1050,
    "tieFrom": 736,
    "tieTo": 980,
    "hoist": 955,
    "load": 468,
    "base": 720
  },
  "lights": [
    {
      "x": 441,
      "y": 563,
      "delay": 0.0,
      "period": 19.0
    },
    {
      "x": 790,
      "y": 525,
      "delay": 5.7,
      "period": 22.3
    },
    {
      "x": 820,
      "y": 601,
      "delay": 11.4,
      "period": 25.6
    },
    {
      "x": 930,
      "y": 563,
      "delay": 17.1,
      "period": 28.9
    },
    {
      "x": 1088,
      "y": 639,
      "delay": 22.8,
      "period": 32.2
    }
  ],
  "distance": [
    {
      "x": 150,
      "w": 104,
      "h": 128
    },
    {
      "x": 268,
      "w": 78,
      "h": 82
    },
    {
      "x": 1210,
      "w": 112,
      "h": 112
    },
    {
      "x": 1338,
      "w": 70,
      "h": 70
    }
  ]
};

export default SCENE;
