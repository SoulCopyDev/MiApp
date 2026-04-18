import React from 'react';
import BaseLevel from '../BaseLevel';

const questions = [
  {
    question: 'Pregunta de ejemplo para Mundo 2 Nivel 4',
    options: ['Opción A', 'Opción B', 'Opción C', 'Opción D'],
    correct: 0,
    explanation: 'Explicación de ejemplo.'
  }
];

export default function World2Level4() {
  return (
    <BaseLevel
      worldId={2}
      levelId={4}
      levelName="Nivel 4 del Mundo 2"
      questions={questions}
    />
  );
}
